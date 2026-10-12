// Voice distress detection: the app sends short audio chunks; we turn speech into text (Whisper) and look for distress words.
// The app also measures loudness on the phone (screaming); "loud" is passed here to judge weak words like "stop".
const express = require('express');
const multer = require('multer');
const { requireAuth } = require('./auth');
const ai = require('./ai');
const { analyse } = require('./keywords');
const { AI } = require('./config');
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 6 * 1024 * 1024 } });

router.get('/status', (req, res) => res.json({ llm: ai.enabled(), stt: ai.enabled(), chatModel: AI.chatModel, sttModel: AI.sttModel }));   // tells the app which AI features are on

router.post('/check', requireAuth, upload.single('audio'), async (req, res) => {
  if (!ai.enabled()) return res.status(503).json({ error: 'Cloud voice is off (no GROQ_API_KEY on the server).', enabled: false });
  if (!req.file) return res.status(400).json({ error: 'No audio received.' });
  const lang = ['en', 'te', 'hi'].includes(req.body.lang) ? req.body.lang : '';
  let text;
  try { text = await ai.transcribe(req.file.buffer, req.file.mimetype, lang); }
  catch (e) { return res.status(502).json({ error: 'Speech service is not responding.', enabled: true }); }
  res.json({ text, ...analyse(text, req.body.loud === '1' || req.body.loud === 'true'), enabled: true });
});
module.exports = { router };
