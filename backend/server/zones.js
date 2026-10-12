// "Safe-zone database": nearby police, hospitals, stations, petrol bunks, 24-hour stores, crowded places (OpenStreetMap, cached in MongoDB).
const { zonesAround } = require('./overpass');
const { dist } = require('./geometry');
const { LABEL } = require('./poi');

async function nearbyZones(lat, lng, radius = 1500) {
  const all = await zonesAround(lat, lng, radius), here = { lat, lng }, seen = new Set();
  return all.map((z) => ({ ...z, label: LABEL[z.t], dist: Math.round(dist(here, z)) }))
    .filter((z) => z.dist <= radius).sort((a, b) => a.dist - b.dist)
    .filter((z) => { const k = z.t + '|' + z.n + '|' + Math.round(z.lat * 2000) + Math.round(z.lng * 2000); if (seen.has(k)) return false; seen.add(k); return true; });
}
module.exports = { nearbyZones };
