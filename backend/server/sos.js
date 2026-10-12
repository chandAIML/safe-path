// SOS: generates the emergency message automatically (name, time, live location, nearest landmark, nearest police station),
// sends it to every contact + primary call, prepares the police alert, and logs the event.
// (Calling 112 must be done by the phone itself - the app shows a "Call 112" button.)
const express = require('express');
const { SosEvent, Checkin, contactsOf } = require('./db');
const { requireAuth } = require('./auth');
const notifier = require('./notifier');
const { nearbyZones } = require('./zones');
const { withTimeout } = require('./http');
const router = express.Router();

const num = (v, lo, hi) => (typeof v === 'number' && v >= lo && v <= hi ? v : null);
const note = (r) => (r.simulated ? ' (simulated, no SMS provider set)' : r.ok ? '' : ' (FAILED)');
const km = (m) => (m >= 1000 ? (m / 1000).toFixed(1) + ' km' : m + ' m');
const istTime = () => new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
const REASONS = { manual: '', shake: 'phone shaken', voice: 'distress words heard', scream: 'loud scream heard', 'missed check-in': 'missed check-in' };

// Emergency message generation: one text for family/friends, a more formal one for the police.
function compose({ user, lat, lng, reason, police, landmark }) {
  const has = lat !== null && lng !== null, link = has ? `https://maps.google.com/?q=${lat},${lng}` : '', why = REASONS[reason] ? ` (${REASONS[reason]})` : '';
  const family = `SOS! ${user.name} may be in danger${why}. Time: ${istTime()}. ` + (has ? `Live location: ${link}${landmark ? ` (near ${landmark})` : ''}. ` : 'Location unavailable. ') +
    (police ? `Nearest police station: ${police.n || 'station'} (${km(police.dist)}). ` : '') + `Audio/video evidence is being recorded. Please call her now: +91 ${user.phone}.`;
  const cops = `EMERGENCY ALERT via SafePath: ${user.name} (+91 ${user.phone}) has triggered an SOS${why}. Time: ${istTime()}. ` +
    (has ? `GPS ${lat.toFixed(5)}, ${lng.toFixed(5)} ${link}${landmark ? ` near ${landmark}` : ''}. ` : 'GPS unavailable. ') + 'Please send help or contact her immediately.';
  return { family, cops };
}

async function trigger(user, { lat = null, lng = null, reason = 'manual' } = {}) {
  await Checkin.updateMany({ userId: user._id, status: 'active' }, { status: 'sos' });
  const cs = await contactsOf(user.id), has = lat !== null && lng !== null, actions = [];
  let police = null, landmark = '';
  if (has) {          // best effort: never delay the alert more than 3 s for this
    try { const z = await withTimeout(nearbyZones(lat, lng, 4000), 3000); police = z.find((x) => x.t === 'P') || null; const near = z.find((x) => x.n && x.dist <= 300); landmark = near ? near.n : ''; } catch (e) { /* ignore */ }
  }
  const { family, cops } = compose({ user, lat, lng, reason, police, landmark });
  actions.push({ ok: true, text: has ? `Location captured (${lat.toFixed(4)}, ${lng.toFixed(4)})${landmark ? ', near ' + landmark : ''}` : 'Location unavailable, contacts told to call you' });
  for (const c of cs) { const r = await notifier.sms(c.phone, family); actions.push({ ok: r.ok, text: `SMS with location sent to ${c.name}${note(r)}` }); }
  if (cs[0]) {
    const r = await notifier.call(cs[0].phone, `Emergency. ${user.name} has triggered an SOS on SafePath. Please check your messages and call her.`);
    actions.push({ ok: r.ok, text: `Calling primary contact: ${cs[0].name}${note(r)}` });
  }
  actions.push({ ok: true, text: police ? `Police alert prepared for ${police.n || 'the nearest police station'} (${km(police.dist)} away) (simulated: no police API, press Call 112)` : 'Police alert prepared for the 112 control room (simulated, press Call 112)' });
  const messages = cs.map((c) => ({ to: c.name, phone: c.phone, text: family }));
  messages.push({ to: `Police · ${police && police.n ? police.n : '112 control room'}`, phone: (police && police.phone) || '112', text: cops });
  return SosEvent.create({ userId: user._id, lat, lng, reason, actions, messages, police: police ? { name: police.n, dist: police.dist, lat: police.lat, lng: police.lng, phone: police.phone } : null });
}

router.post('/', requireAuth, async (req, res) => {
  const recent = await SosEvent.findOne({ userId: req.user._id }).sort({ at: -1 });
  const reply = (r) => ({ id: r.id, actions: r.actions, messages: r.messages, police: r.police || null, simulated: r.actions.some((a) => /simulated/.test(a.text)) });
  if (recent && Date.now() - recent.at < 10000) return res.json(reply(recent)); // ignore double-taps
  const b = req.body || {};
  const rec = await trigger(req.user, { lat: num(b.lat, -90, 90), lng: num(b.lng, -180, 180), reason: REASONS[b.reason] !== undefined ? b.reason : 'manual' });
  res.status(201).json(reply(rec));
});

router.get('/', requireAuth, async (req, res) => {
  const events = await SosEvent.find({ userId: req.user._id }).sort({ at: -1 }).limit(20);
  res.json({ events: events.map((e) => ({ id: e.id, at: e.at, lat: e.lat, lng: e.lng, reason: e.reason, actions: e.actions })) });
});

module.exports = { router, trigger };
