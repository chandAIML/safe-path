// Check-in timer. The server is the safety net: if the phone dies or the app is closed and the
// user never confirms, the server triggers the SOS by itself after end-time + grace period.
const express = require('express');
const { Checkin, User } = require('./db');
const { requireAuth } = require('./auth');
const { trigger } = require('./sos');
const { GRACE_MS } = require('./config');
const router = express.Router();
router.use(requireAuth);

const active = uid => Checkin.findOne({ userId: uid, status: 'active' });
const num = (v, lo, hi) => (typeof v === 'number' && v >= lo && v <= hi ? v : null);

router.get('/', async (req, res) => { const c = await active(req.user._id); res.json({ checkin: c ? { end: c.end } : null }); });

router.post('/', async (req, res) => {
  const m = Number(req.body && req.body.minutes);
  if (!(m >= 0.1 && m <= 240)) return res.status(400).json({ error: 'Choose a time between a few seconds and 4 hours.' });
  await Checkin.updateMany({ userId: req.user._id, status: 'active' }, { status: 'replaced' });
  const c = await Checkin.create({ userId: req.user._id, end: Date.now() + m * 60000,
    lat: num(req.body.lat, -90, 90), lng: num(req.body.lng, -180, 180) });
  res.status(201).json({ checkin: { end: c.end } });
});

router.post('/extend', async (req, res) => {
  const c = await active(req.user._id);
  if (!c) return res.status(404).json({ error: 'No active check-in.' });
  c.end += Math.min(60, Math.max(1, Number(req.body && req.body.minutes) || 10)) * 60000;
  await c.save(); res.json({ checkin: { end: c.end } });
});

router.post('/confirm', async (req, res) => {
  await Checkin.updateMany({ userId: req.user._id, status: 'active' }, { status: 'confirmed' });
  res.json({ ok: true });
});

async function sweep() {
  const due = await Checkin.find({ status: 'active', end: { $lt: Date.now() - GRACE_MS } });
  for (const c of due) {
    // claim it atomically so two server instances never send the same SOS twice
    const claimed = await Checkin.findOneAndUpdate({ _id: c._id, status: 'active' }, { status: 'sos' });
    if (!claimed) continue;
    const u = await User.findById(c.userId);
    if (u) await trigger(u, { lat: c.lat, lng: c.lng, reason: 'missed check-in' }).catch(console.error);
  }
}
module.exports = { router, sweep, start: () => setInterval(() => sweep().catch(console.error), 5000) };
