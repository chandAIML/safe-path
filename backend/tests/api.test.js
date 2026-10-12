// Run with: npm test   (needs MongoDB running; uses a throw-away database and a fake "internet", so it works offline)
const os = require('os'), fs = require('fs'), path = require('path');
const PM = 46000 + Math.floor(Math.random() * 2000), M = `http://127.0.0.1:${PM}`;
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'safepath-'));
process.env.CHECKIN_GRACE_SEC = '0';
Object.assign(process.env, { OVERPASS_URL: M + '/overpass', OSRM_URL: M + '/osrm', NOMINATIM_URL: M + '/nominatim', PHOTON_URL: M + '/photon', OPENMETEO_URL: M + '/openmeteo', LLM_BASE_URL: M + '/llm', GROQ_API_KEY: 'test-key' });
const test = require('node:test'), assert = require('node:assert');
const { mock, FROM, B } = require('./mock-external');
const app = require('../server/index');
const { connect, mongoose, Checkin } = require('../server/db');
const { sweep } = require('../server/checkin');
const risk = require('../server/risk');
const { vector } = require('../ml/features');
const { analyse } = require('../server/keywords');
const { ruleReply } = require('../server/chat');

const MONGO = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/safepath_test_' + Date.now();
let base, token, server;
test.before(async () => {
  await mock.start(PM); await connect(MONGO);
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', () => { base = 'http://127.0.0.1:' + server.address().port; r(); }); });
});
test.after(async () => { server.close(); mock.stop(); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });

const call = async (m, u, b, t = token) => {
  const r = await fetch(base + '/api' + u, { method: m, headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b ? JSON.stringify(b) : undefined });
  return { s: r.status, j: await r.json() };
};
const form = async (u, fd, t = token) => { const r = await fetch(base + '/api' + u, { method: 'POST', headers: t ? { Authorization: 'Bearer ' + t } : {}, body: fd }); return { s: r.status, j: await r.json() }; };
const reg = { name: 'Anusha Devi', phone: '98765 43210', password: 'secret1', days: 7, contacts: [{ name: 'Amma', phone: '9123456780', rel: 'Mother' }, { name: 'Ravi', phone: '+91 9123456781', rel: 'Friend' }] };
const newUser = async (phone) => (await call('POST', '/auth/register', { ...reg, name: 'User ' + phone, phone, contacts: [{ name: 'Mom', phone: '9000011111' }] }, null)).j.token;

// ---------------- authentication, contacts, SOS, check-in ----------------
test('register validates input', async () => {
  assert.equal((await call('POST', '/auth/register', { ...reg, password: '123' })).s, 400);
  assert.equal((await call('POST', '/auth/register', { ...reg, contacts: [] })).s, 400);
  assert.equal((await call('POST', '/auth/register', { ...reg, contacts: [{ name: 'Me', phone: '9876543210' }] })).s, 400);
  assert.equal((await call('POST', '/auth/register', { ...reg, phone: '12345' })).s, 400);
});
test('register, duplicate, login, me', async () => {
  const r = await call('POST', '/auth/register', reg);
  assert.equal(r.s, 201); assert.ok(r.j.token); assert.equal(r.j.user.phone, '9876543210'); assert.equal(r.j.user.hash, undefined);
  assert.equal((await call('POST', '/auth/register', reg)).s, 409);
  assert.equal((await call('POST', '/auth/login', { id: '9876543210', password: 'wrong' })).s, 401);
  const l = await call('POST', '/auth/login', { id: '+91 98765 43210', password: 'secret1', days: 30 });
  assert.equal(l.s, 200); token = l.j.token; assert.ok(l.j.exp - Date.now() > 29 * 864e5);
  assert.equal((await call('GET', '/auth/me')).j.user.name, 'Anusha Devi');
  assert.equal((await call('GET', '/auth/me', null, 'bad.token')).s, 401);
  assert.equal((await call('GET', '/contacts', null, null)).s, 401);
});
test('login locks after 5 wrong passwords', async () => {
  for (let i = 0; i < 5; i++) await call('POST', '/auth/login', { id: 'lock@test.com', password: 'x' });
  assert.equal((await call('POST', '/auth/login', { id: 'lock@test.com', password: 'x' })).s, 429);
});
test('contacts: add, duplicate, primary, delete, keep one', async () => {
  let r = await call('POST', '/contacts', { name: 'Dad', phone: '9000000001', rel: 'Father' });
  assert.equal(r.s, 201); assert.equal(r.j.contacts.length, 3);
  assert.equal((await call('POST', '/contacts', { name: 'Dad2', phone: '9000000001' })).s, 400);
  const dad = r.j.contacts.find((c) => c.name === 'Dad');
  r = await call('PUT', `/contacts/${dad.id}/primary`); assert.equal(r.j.contacts[0].name, 'Dad');
  await call('POST', '/contacts', { name: 'Sis', phone: '9000000002' }); await call('POST', '/contacts', { name: 'Fri', phone: '9000000003' });
  assert.equal((await call('POST', '/contacts', { name: 'Six', phone: '9000000004' })).s, 400);
  assert.equal((await call('DELETE', '/contacts/not-an-id')).s, 404);
  r = await call('DELETE', `/contacts/${dad.id}`); assert.equal(r.j.contacts.length, 4);
});
test('SOS: auto-generated messages for contacts AND police, with location, landmark and nearest police station', async () => {
  const r = await call('POST', '/sos', { lat: 18.105, lng: 83.405 });
  assert.equal(r.s, 201);
  const t = r.j.actions.map((a) => a.text).join('|');
  assert.match(t, /Location captured/); assert.match(t, /Calling primary contact/); assert.match(t, /Police alert prepared for Test Police Station/);
  assert.equal(r.j.actions.filter((a) => /^SMS/.test(a.text)).length, 4);
  assert.equal(r.j.messages.length, 5);                                   // 4 contacts + police
  const fam = r.j.messages[0].text;
  assert.match(fam, /maps\.google\.com\/\?q=18\.105,83\.405/); assert.match(fam, /Nearest police station: Test Police Station/); assert.match(fam, /\+91 9876543210/); assert.match(fam, /evidence/i);
  const cops = r.j.messages[4]; assert.match(cops.to, /^Police · Test Police Station/); assert.match(cops.text, /EMERGENCY ALERT via SafePath/); assert.equal(cops.phone, '08922-100100');
  assert.equal(r.j.police.name, 'Test Police Station'); assert.equal(r.j.simulated, true);
  assert.equal((await call('POST', '/sos', {})).j.id, r.j.id);          // double tap is ignored
  assert.equal((await call('GET', '/sos')).j.events.length, 1);
});
test('check-in: start, extend, confirm', async () => {
  assert.equal((await call('POST', '/checkin', { minutes: 0 })).s, 400);
  const s = await call('POST', '/checkin', { minutes: 30 }); assert.equal(s.s, 201);
  const e = await call('POST', '/checkin/extend', { minutes: 10 }); assert.ok(e.j.checkin.end - s.j.checkin.end >= 599000);
  await call('POST', '/checkin/confirm'); assert.equal((await call('GET', '/checkin')).j.checkin, null);
});
test('check-in missed -> server triggers SOS on its own', async () => {
  const before = (await call('GET', '/sos')).j.events.length;
  await call('POST', '/checkin', { minutes: 30, lat: 18.1, lng: 83.4 });
  await Checkin.updateMany({ status: 'active' }, { end: Date.now() - 5000 });
  await sweep(); await sweep();
  const ev = (await call('GET', '/sos')).j.events;
  assert.equal(ev.length, before + 1); assert.equal(ev[0].reason, 'missed check-in');
  assert.equal((await call('GET', '/checkin')).j.checkin, null);
});

// ---------------- profile ----------------
test('profile: edit details, phone change needs password, password change logs out old tokens, delete account', async () => {
  const t = await newUser('9111100001'), c = (m, u, b) => call(m, u, b, t);
  assert.equal((await c('PUT', '/auth/me', { name: 'New Name', email: 'new@mail.com' })).j.user.name, 'New Name');
  assert.equal((await c('PUT', '/auth/me', { email: 'bad' })).s, 400);
  assert.equal((await c('PUT', '/auth/me', { phone: '9111100002' })).s, 403);                 // needs current password
  assert.equal((await c('PUT', '/auth/me', { phone: '9111100002', currentPassword: 'secret1' })).j.user.phone, '9111100002');
  assert.equal((await c('PUT', '/auth/me', { phone: '9000011111', currentPassword: 'secret1' })).s, 400);   // is an emergency contact
  assert.equal((await c('POST', '/auth/password', { current: 'nope', next: 'newpass1' })).s, 403);
  const np = await c('POST', '/auth/password', { current: 'secret1', next: 'newpass1' }); assert.equal(np.s, 200);
  assert.equal((await c('GET', '/auth/me')).s, 401);                                           // old token is dead
  assert.equal((await call('GET', '/auth/me', null, np.j.token)).s, 200);                     // new token works
  assert.equal((await call('POST', '/auth/login', { id: '9111100002', password: 'newpass1' }, null)).s, 200);
  assert.equal((await call('DELETE', '/auth/me', { password: 'wrong' }, np.j.token)).s, 403);
  assert.equal((await call('DELETE', '/auth/me', { password: 'newpass1' }, np.j.token)).s, 200);
  assert.equal((await call('POST', '/auth/login', { id: '9111100002', password: 'newpass1' }, null)).s, 401);
});

// ---------------- ML risk model + route planning ----------------
test('risk model: night + unlit + isolated is far riskier than day + lit + crowded; model info present', () => {
  const base = { dark: 0, lateNight: 0, lit: 0.75, crowd: 0.6, roadIso: 0, helpFar: 0.2, crime: 0.1, reports: 0, rain: 0 };
  const day = risk.predict(vector(base)), bad = risk.predict(vector({ ...base, dark: 1, lateNight: 1, lit: 0.1, crowd: 0.05, roadIso: 0.7, helpFar: 0.9 }));
  assert.ok(day < 0.1 && bad > 0.7, `day ${day}, bad ${bad}`);
  assert.ok(risk.predict(vector({ ...base, reports: 0.7 })) > day);                           // more reports -> more risk
  assert.ok(risk.model.test.auc > 0.75 && risk.model.trainedOn);
});
let planNight, planDay;
test('route plan: finds routes, scores them, safest = lit main road with shops + police (esp. at night)', async () => {
  const plan = (hour) => call('POST', '/route/plan', { from: FROM, query: 'Test Bus Stand', hour });
  planNight = await plan(23); planDay = await plan(12);
  assert.equal(planNight.s, 200); assert.equal(planNight.j.routes.length, 2);
  const iA = planNight.j.routes.findIndex((r) => r.min === 10), iB = 1 - iA;
  const nA = planNight.j.routes[iA], nB = planNight.j.routes[iB], dA = planDay.j.routes[iA], dB = planDay.j.routes[iB];
  assert.equal(planNight.j.best, iA); assert.equal(nA.name, 'Fastest and safest');
  assert.ok(nA.score - nB.score >= 20, `night: ${nA.score} vs ${nB.score}`);
  assert.ok(nA.score - nB.score > dA.score - dB.score, 'night should widen the gap');
  assert.ok(nB.alerts.length > 0 && /lighting|few people|isolated/.test(nB.alerts[0].text), 'predictive alert on the quiet road');
  assert.ok(nB.hot.length > 0 && nA.alerts.length === 0 || nA.alerts.length < nB.alerts.length);
  assert.ok(nA.pois.some((p) => p.t === 'P' && p.n === 'Test Police Station') && nA.pois.some((p) => p.t === 'G'));
  assert.equal(planNight.j.meta.hourLabel, '11:00 PM'); assert.equal(planNight.j.meta.dark, 1); assert.equal(planDay.j.meta.dark, 0);
  assert.equal(planNight.j.meta.weather.condition, 'Clear'); assert.equal(planNight.j.meta.simulatedTime, true);
  assert.ok(planNight.j.notes.some((n) => /Crime layer: simulated/.test(n)));
  assert.equal(nA.pts.length > 5 && Array.isArray(nA.pts[0]), true);
});
test('route plan: errors are friendly, OpenStreetMap answers are cached', async () => {
  assert.equal((await call('POST', '/route/plan', { from: FROM, query: 'nowhere land' })).s, 404);
  assert.equal((await call('POST', '/route/plan', { query: 'x' })).s, 400);
  assert.equal((await call('POST', '/route/plan', { from: FROM })).s, 400);
  const n = mock.overpassCalls; await call('POST', '/route/plan', { from: FROM, query: 'Test Bus Stand', hour: 20 });
  assert.equal(mock.overpassCalls, n, 'same route must come from the MongoDB cache, not Overpass');
  assert.equal((await call('POST', '/route/plan', { from: FROM, query: 'x', hour: 1 }, null)).s, 401);
});
test('user reports lower the score of routes through the reported spot', async () => {
  const iB = planNight.j.routes.findIndex((r) => r.min === 13), before = planNight.j.routes[iB];
  assert.equal((await call('POST', '/reports', { lat: B[13].lat, lng: B[13].lng, type: 'harassment', note: 'men staring' })).s, 201);
  assert.equal((await call('POST', '/reports', { lat: 99, lng: 0 })).s, 400);
  const after = (await call('POST', '/route/plan', { from: FROM, query: 'Test Bus Stand', hour: 23 })).j, rB = after.routes[iB];
  assert.ok(rB.score < before.score, `${rB.score} should be below ${before.score}`); assert.equal(rB.factors.reports, 1); assert.equal(after.meta.reportsNearby, 1);
  assert.equal((await call('GET', `/reports/nearby?lat=${B[13].lat}&lng=${B[13].lng}`)).j.reports.length, 1);
});
test('risk right here + safe zones', async () => {
  const r = await call('POST', '/risk/point', { lat: B[13].lat, lng: B[13].lng, hour: 23 });
  assert.equal(r.s, 200); assert.ok(['medium', 'high', 'caution'].includes(r.j.point.level)); assert.ok(r.j.point.why.length > 0); assert.ok(r.j.zones.length > 0); assert.equal(r.j.hourLabel, '11:00 PM');
  const z = await call('GET', '/safezones?lat=18.105&lng=83.405&radius=2000');
  assert.equal(z.j.zones[0].t, 'P'); assert.equal(z.j.zones[0].n, 'Test Police Station'); assert.ok(z.j.counts.H >= 1 && z.j.counts.G >= 1 && z.j.counts.T >= 1 && z.j.counts.S >= 1 && z.j.counts.C >= 1);
  const h = await call('GET', '/safezones?lat=18.105&lng=83.405&type=H'); assert.ok(h.j.zones.length > 0 && h.j.zones.every((x) => x.t === 'H'));
});

// ---------------- AI: chatbot + voice ----------------
test('chatbot: LLM answer (with SOS tag), offline rule fallback, Telugu', async () => {
  const ask = (text, extra) => call('POST', '/chat', { messages: [{ role: 'user', content: text }], context: { lat: 18.105, lng: 83.405 }, ...extra });
  let r = await ask('A man is being followed me on the road'); assert.equal(r.j.source, 'ai'); assert.equal(r.j.sos, true); assert.ok(!/\[SOS\]/.test(r.j.reply));
  r = await ask('Is it okay to walk home late?'); assert.equal(r.j.source, 'ai'); assert.equal(r.j.sos, false);
  mock.llmFail = true;
  r = await ask('Cab driver is taking a wrong route'); assert.equal(r.j.source, 'rules'); assert.match(r.j.reply, /lit, crowded place/); assert.match(r.j.reply, /Nearest help: Police: Test Police Station/);
  r = await ask('someone is following me'); assert.equal(r.j.sos, true); assert.match(r.j.reply, /112/);
  r = await ask('నన్ను ఎవరో ఫాలో చేస్తున్నారు'); assert.equal(r.j.sos, true); assert.match(r.j.reply, /[\u0C00-\u0C7F]/);
  mock.llmFail = false;
  assert.equal((await call('POST', '/chat', { messages: [] })).s, 400); assert.equal((await call('POST', '/chat', { messages: [{ role: 'user', content: 'hi' }] }, null)).s, 401);
  assert.match(ruleReply('harassed by men commenting', '').reply, /nothing wrong/);
});
test('distress keywords: strong words, weak words need loudness or repetition, no false alarms', () => {
  for (const t of ['help', 'please help me', 'Bachao bachao', 'leave me alone', 'కాపాడండి', 'मुझे बचाओ', 'save me']) assert.equal(analyse(t, false).level, 'sos', t);
  assert.equal(analyse('stop', false).level, 'warn'); assert.equal(analyse('stop', true).level, 'sos'); assert.equal(analyse('stop stop', false).level, 'sos'); assert.equal(analyse('వద్దు వద్దు', false).level, 'sos');
  for (const t of ['hello how are you', 'this is helpful', 'helping hand', 'I am going home', 'bus stop is near']) assert.equal(analyse(t, false).level, t === 'bus stop is near' ? 'warn' : null, t);
});
test('voice: Whisper transcript -> distress decision (and AI status is public)', async () => {
  assert.equal((await call('GET', '/voice/status', null, null)).j.stt, true);
  const send = async (text, loud) => { mock.transcript = text; const fd = new FormData(); fd.append('audio', new Blob([Buffer.alloc(2000, 1)], { type: 'audio/m4a' }), 'c.m4a'); fd.append('lang', 'en'); fd.append('loud', loud ? '1' : '0'); return form('/voice/check', fd); };
  let r = await send('help me please', false); assert.equal(r.s, 200); assert.equal(r.j.level, 'sos'); assert.equal(r.j.text, 'help me please');
  assert.equal((await send('stop', false)).j.level, 'warn'); assert.equal((await send('stop', true)).j.level, 'sos'); assert.equal((await send('good morning', false)).j.level, null);
  assert.equal((await form('/voice/check', new FormData())).s, 400); assert.equal((await form('/voice/check', new FormData(), null)).s, 401);
});

// ---------------- evidence ----------------
test('evidence: upload video + GPS track + timestamps, list, download, delete', async () => {
  const bytes = Buffer.from('FAKE-MP4-DATA-' + 'x'.repeat(5000)), fd = new FormData();
  fd.append('video', new Blob([bytes], { type: 'video/mp4' }), 'clip.mp4');
  fd.append('meta', JSON.stringify({ sosId: 'abc', startedAt: 1000, endedAt: 21000, track: [{ lat: 18.1, lng: 83.4, t: 1000 }, { lat: 18.1001, lng: 83.4002, t: 6000 }, { lat: 'bad', lng: 1, t: 1 }] }));
  const up = await form('/evidence', fd); assert.equal(up.s, 201); assert.equal(up.j.size, bytes.length);
  const list = (await call('GET', '/evidence')).j.items; assert.equal(list.length, 1); assert.equal(list[0].points, 2); assert.equal(list[0].endedAt - list[0].startedAt, 20000);
  const dl = await fetch(`${base}/api/evidence/${up.j.id}/file`, { headers: { Authorization: 'Bearer ' + token } }); assert.equal(Buffer.from(await dl.arrayBuffer()).equals(bytes), true);
  assert.equal((await call('DELETE', `/evidence/${up.j.id}`)).s, 200); assert.equal((await call('GET', '/evidence')).j.items.length, 0);
  const bad = new FormData(); bad.append('video', new Blob(['x'], { type: 'text/html' }), 'x.html'); assert.equal((await form('/evidence', bad)).s, 400);
});
