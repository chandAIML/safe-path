// Authentication: register, login, session check. Passwords are hashed with bcrypt,
// sessions are signed JWTs whose lifetime matches the "keep me signed in" choice.
const express = require('express'), bcrypt = require('bcryptjs'), jwt = require('jsonwebtoken');
const fs = require('fs'), path = require('path');
const { User, Contact, SosEvent, Checkin, Report, Evidence } = require('./db');
const { SECRET, EVIDENCE_DIR } = require('./config');
const { normPhone, validEmail, cleanContact } = require('./util');
const router = express.Router();

const pub = u => ({ id: u.id, name: u.name, phone: u.phone, email: u.email || '' });
function issue(user, days) {
  days = Math.min(30, Math.max(1, Math.round(+days) || 7));
  const token = jwt.sign({ sub: user.id, tv: user.tv || 0 }, SECRET, { expiresIn: days + 'd' });
  return { token, exp: Date.now() + days * 864e5, user: pub(user) };
}

async function requireAuth(req, res, next) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!m) return res.status(401).json({ error: 'Please sign in.' });
  try {
    const p = jwt.verify(m[1], SECRET);
    const u = await User.findById(p.sub);
    if (!u || (p.tv || 0) !== (u.tv || 0)) throw new Error('no user');       // tv changes when the password changes
    req.user = u; next();
  } catch (e) { res.status(401).json({ error: 'Your session has expired. Sign in again.' }); }
}

router.post('/register', async (req, res) => {
  const b = req.body || {};
  const name = String(b.name || '').trim(), phone = normPhone(b.phone);
  const email = String(b.email || '').trim().toLowerCase(), pw = String(b.password || '');
  if (name.length < 2 || name.length > 60) return res.status(400).json({ error: 'Enter your full name.' });
  if (!phone) return res.status(400).json({ error: 'Enter a valid 10-digit mobile number.' });
  if (email && !validEmail(email)) return res.status(400).json({ error: 'That email doesn’t look right.' });
  if (pw.length < 6 || pw.length > 72) return res.status(400).json({ error: 'Password must be 6 to 72 characters.' });
  if (!Array.isArray(b.contacts) || b.contacts.length < 1 || b.contacts.length > 5)
    return res.status(400).json({ error: 'Add 1 to 5 emergency contacts.' });
  const list = [];
  for (const c of b.contacts) {
    const r = cleanContact(c, phone, list);
    if (r.error) return res.status(400).json({ error: r.error });
    list.push(r.value);
  }
  const taken = { error: 'This mobile number or email is already registered. Sign in instead.' };
  if (await User.findOne({ $or: [{ phone }, ...(email ? [{ email }] : [])] })) return res.status(409).json(taken);

  let user;
  try { user = await User.create({ name, phone, email, hash: await bcrypt.hash(pw, 10) }); }
  catch (e) { if (e.code === 11000) return res.status(409).json(taken); throw e; }
  try { await Contact.insertMany(list.map((c, i) => ({ ...c, userId: user._id, order: i }))); }
  catch (e) { await User.deleteOne({ _id: user._id }); throw e; }
  res.status(201).json(issue(user, b.days));
});

// Simple brute-force protection: 5 wrong passwords -> 10 minute lock per account id.
const fails = new Map();
router.post('/login', async (req, res) => {
  const b = req.body || {};
  const key = String(b.id || '').trim().toLowerCase();
  const f = fails.get(key);
  if (f && f.n >= 5 && Date.now() < f.until)
    return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
  const phone = normPhone(key);
  const user = key.length > 2 && await User.findOne(phone ? { phone } : { email: key });
  const ok = user && await bcrypt.compare(String(b.password || ''), user.hash);
  if (!ok) {
    const n = (f && Date.now() < f.until ? f.n : 0) + 1;
    fails.set(key, { n, until: Date.now() + 10 * 60000 });
    return res.status(401).json({ error: 'Wrong phone/email or password.' });
  }
  fails.delete(key);
  res.json(issue(user, b.days));
});

router.get('/me', requireAuth, (req, res) => res.json({ user: pub(req.user) }));

// ---- Profile: edit details, change password, delete account ----
const sameUser = (u, extra) => bcrypt.compare(String(extra || ''), u.hash);
router.put('/me', requireAuth, async (req, res) => {
  const b = req.body || {}, u = req.user;
  if (b.name !== undefined) {
    const name = String(b.name).trim();
    if (name.length < 2 || name.length > 60) return res.status(400).json({ error: 'Enter your full name.' });
    u.name = name;
  }
  if (b.email !== undefined) {
    const email = String(b.email).trim().toLowerCase();
    if (email && !validEmail(email)) return res.status(400).json({ error: 'That email doesn’t look right.' });
    if (email && await User.findOne({ email, _id: { $ne: u._id } })) return res.status(409).json({ error: 'This email is already used by another account.' });
    u.email = email;
  }
  if (b.phone !== undefined) {
    const phone = normPhone(b.phone);
    if (!phone) return res.status(400).json({ error: 'Enter a valid 10-digit mobile number.' });
    if (phone !== u.phone) {
      if (!(await sameUser(u, b.currentPassword))) return res.status(403).json({ error: 'Enter your current password to change your mobile number.' });
      if (await User.findOne({ phone, _id: { $ne: u._id } })) return res.status(409).json({ error: 'This mobile number is already registered.' });
      if (await Contact.findOne({ userId: u._id, phone })) return res.status(400).json({ error: 'That number is one of your emergency contacts.' });
      u.phone = phone;
    }
  }
  await u.save(); res.json({ user: pub(u) });
});

router.post('/password', requireAuth, async (req, res) => {
  const b = req.body || {}, u = req.user, next = String(b.next || '');
  if (!(await sameUser(u, b.current))) return res.status(403).json({ error: 'Current password is wrong.' });
  if (next.length < 6 || next.length > 72) return res.status(400).json({ error: 'New password must be 6 to 72 characters.' });
  u.hash = await bcrypt.hash(next, 10); u.tv = (u.tv || 0) + 1;       // old logins on other phones stop working
  await u.save(); res.json(issue(u, b.days));
});

router.delete('/me', requireAuth, async (req, res) => {
  const u = req.user;
  if (!(await sameUser(u, (req.body || {}).password))) return res.status(403).json({ error: 'Password is wrong.' });
  await Promise.all([Contact.deleteMany({ userId: u._id }), SosEvent.deleteMany({ userId: u._id }), Checkin.deleteMany({ userId: u._id }), Report.deleteMany({ userId: u._id }), Evidence.deleteMany({ userId: u._id })]);
  fs.rmSync(path.join(EVIDENCE_DIR, String(u.id)), { recursive: true, force: true });
  await User.deleteOne({ _id: u._id });
  res.json({ ok: true });
});

module.exports = { router, requireAuth };
