// Loads .env (tiny parser, no dependency) and exposes settings.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
try {
  fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split('\n').forEach(l => {
    const m = /^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/.exec(l);
    if (m && !l.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  });
} catch (e) { /* no .env file */ }

const DATA = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA, { recursive: true });
let secret = process.env.JWT_SECRET;
if (!secret) {                       // generate once and keep, so logins survive a restart
  const f = path.join(DATA, '.jwt-secret');
  try { secret = fs.readFileSync(f, 'utf8'); }
  catch (e) { secret = crypto.randomBytes(48).toString('hex'); fs.writeFileSync(f, secret, { mode: 0o600 }); }
}
const list = (env, defaults) => (process.env[env] ? [process.env[env]] : defaults);
module.exports = {
  DATA, SECRET: secret,
  PORT: +process.env.API_PORT || 5050,      // 5050 (not 3000): port 3000 is often used by other programs
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/safepath',
  GRACE_MS: (process.env.CHECKIN_GRACE_SEC !== undefined ? +process.env.CHECKIN_GRACE_SEC : 90) * 1000,
  EVIDENCE_DIR: process.env.EVIDENCE_DIR || path.join(DATA, 'evidence'),
  // GenAI chatbot + voice keyword detection. One FREE Groq key (console.groq.com/keys) enables both. Works with any OpenAI-compatible API.
  AI: {
    key: process.env.GROQ_API_KEY || process.env.LLM_API_KEY || '',
    base: process.env.LLM_BASE_URL || 'https://api.groq.com/openai/v1',
    chatModel: process.env.LLM_MODEL || 'llama-3.3-70b-versatile',
    fallbackModel: 'llama-3.1-8b-instant',
    sttModel: process.env.STT_MODEL || 'whisper-large-v3-turbo',
  },
  // Free map / data services (no API key needed). Each has a backup address.
  URLS: {
    overpass: list('OVERPASS_URL', ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']),
    osrm: list('OSRM_URL', ['https://router.project-osrm.org', 'https://routing.openstreetmap.de/routed-car']),
    nominatim: process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org',
    photon: process.env.PHOTON_URL || 'https://photon.komoot.io',
    meteo: process.env.OPENMETEO_URL || 'https://api.open-meteo.com',
  },
  CRIME_CSV: process.env.CRIME_CSV || path.join(__dirname, '..', 'data-seed', 'crime_hotspots.csv'),
};
