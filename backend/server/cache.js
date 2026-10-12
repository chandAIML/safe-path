// Remember answers from free outside services (OpenStreetMap, weather) in MongoDB. A cache problem never breaks a request.
const crypto = require('crypto');
const { Cache } = require('./db');
const hash = (s) => crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 20);

async function cached(key, ttlMs, fn) {
  try { const hit = await Cache.findOne({ key }); if (hit && hit.expiresAt > Date.now()) return hit.value; } catch (e) { /* ignore */ }
  const value = await fn();
  try { await Cache.updateOne({ key }, { value, expiresAt: Date.now() + ttlMs }, { upsert: true }); } catch (e) { /* ignore */ }
  return value;
}
module.exports = { cached, hash };
