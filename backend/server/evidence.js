// Automatic evidence: during an SOS the phone records front-camera video + audio and uploads it here with GPS track and timestamps.
const express = require('express'), multer = require('multer'), fs = require('fs'), path = require('path');
const { Evidence, mongoose } = require('./db');
const { requireAuth } = require('./auth');
const { EVIDENCE_DIR } = require('./config');
const router = express.Router();
router.use(requireAuth);

const storage = multer.diskStorage({
  destination: (req, f, cb) => { const d = path.join(EVIDENCE_DIR, String(req.user.id)); fs.mkdirSync(d, { recursive: true }); cb(null, d); },
  filename: (req, f, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${path.extname(f.originalname || '') || '.mp4'}`),
});
const upload = multer({ storage, limits: { fileSize: 80 * 1024 * 1024 }, fileFilter: (req, f, cb) => cb(null, /^(video|audio)\/|octet-stream/.test(f.mimetype)) });

router.post('/', upload.single('video'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No video received.' });
  let meta = {}; try { meta = JSON.parse(req.body.meta || '{}'); } catch (e) { /* ignore */ }
  const track = (Array.isArray(meta.track) ? meta.track : []).slice(0, 600).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)).map((p) => ({ lat: p.lat, lng: p.lng, t: +p.t || 0 }));
  const ev = await Evidence.create({ userId: req.user._id, sosId: String(meta.sosId || ''), file: req.file.path, size: req.file.size, mime: req.file.mimetype,
    startedAt: +meta.startedAt || Date.now(), endedAt: +meta.endedAt || Date.now(), track });
  res.status(201).json({ id: ev.id, size: ev.size });
});

const view = (e) => ({ id: e.id, sosId: e.sosId, size: e.size, startedAt: e.startedAt, endedAt: e.endedAt, uploadedAt: e.uploadedAt, points: e.track.length, first: e.track[0] || null, last: e.track[e.track.length - 1] || null });
router.get('/', async (req, res) => res.json({ items: (await Evidence.find({ userId: req.user._id }).sort({ uploadedAt: -1 }).limit(50)).map(view) }));

router.get('/:id/file', async (req, res) => {
  const e = mongoose.isValidObjectId(req.params.id) && await Evidence.findOne({ _id: req.params.id, userId: req.user._id });
  if (!e || !fs.existsSync(e.file)) return res.status(404).json({ error: 'Not found.' });
  res.sendFile(path.resolve(e.file));
});
router.delete('/:id', async (req, res) => {
  const e = mongoose.isValidObjectId(req.params.id) && await Evidence.findOne({ _id: req.params.id, userId: req.user._id });
  if (!e) return res.status(404).json({ error: 'Not found.' });
  fs.rmSync(e.file, { force: true }); await e.deleteOne(); res.json({ ok: true });
});
module.exports = { router };
