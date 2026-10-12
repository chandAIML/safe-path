// Community reports of unsafe places. They feed the risk model, so routes through reported spots score lower.
const express = require('express');
const { Report } = require('./db');
const { requireAuth } = require('./auth');
const router = express.Router();
router.use(requireAuth);
const TYPES = ['harassment', 'poor_lighting', 'isolated', 'stalking', 'theft', 'other'];
const num = (v, lo, hi) => (typeof v === 'number' && v >= lo && v <= hi ? v : null);

router.post('/', async (req, res) => {
  const b = req.body || {}, lat = num(b.lat, -90, 90), lng = num(b.lng, -180, 180);
  if (lat === null || lng === null) return res.status(400).json({ error: 'Location needed to report a spot.' });
  const type = TYPES.includes(b.type) ? b.type : 'other';
  const today = await Report.countDocuments({ userId: req.user._id, at: { $gt: Date.now() - 864e5 } });
  if (today >= 10) return res.status(429).json({ error: 'You can send up to 10 reports a day.' });
  const r = await Report.create({ userId: req.user._id, lat, lng, type, note: String(b.note || '').slice(0, 200) });
  res.status(201).json({ id: r.id, ok: true });
});

router.get('/nearby', async (req, res) => {
  const lat = parseFloat(req.query.lat), lng = parseFloat(req.query.lng), d = Math.min(0.05, (+req.query.radius || 1500) / 111000);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return res.status(400).json({ error: 'Location needed.' });
  const rows = await Report.find({ lat: { $gte: lat - d, $lte: lat + d }, lng: { $gte: lng - d, $lte: lng + d } }).sort({ at: -1 }).limit(100);
  res.json({ reports: rows.map((r) => ({ id: r.id, lat: r.lat, lng: r.lng, type: r.type, note: r.note, at: r.at })) });
});
module.exports = { router, TYPES };
