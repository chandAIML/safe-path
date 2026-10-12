// Crime-density layer, 0..1.
//  - If data-seed/crime_hotspots.csv has rows (real hotspots), they are used.
//  - Otherwise a SIMULATED smooth layer is used (clearly labelled "demo data"), because no public geotagged crime data exists for Indian cities.
const fs = require('fs');
const { CRIME_CSV } = require('./config');
const { dist } = require('./geometry');

let hotspots = [];
try {
  hotspots = fs.readFileSync(CRIME_CSV, 'utf8').trim().split(/\r?\n/).slice(1).filter(Boolean)
    .map((l) => { const [lat, lng, r, s] = l.split(',').map(Number); return { lat, lng, r, s }; }).filter((h) => Number.isFinite(h.lat) && Number.isFinite(h.lng));
} catch (e) { /* no file */ }

const hash2 = (i, j) => { let h = (i * 374761393 + j * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const smooth = (t) => t * t * (3 - 2 * t);
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), u = smooth(x - xi), v = smooth(y - yi);
  return hash2(xi, yi) * (1 - u) * (1 - v) + hash2(xi + 1, yi) * u * (1 - v) + hash2(xi, yi + 1) * (1 - u) * v + hash2(xi + 1, yi + 1) * u * v;
}
const clamp = (x) => Math.max(0, Math.min(1, x));

function crimeIndex(lat, lng) {
  if (hotspots.length) return clamp(Math.max(...hotspots.map((h) => h.s * Math.exp(-((dist({ lat, lng }, h) / h.r) ** 2)))));
  return clamp((0.6 * vnoise(lat * 90, lng * 90) + 0.4 * vnoise(lat * 300 + 7, lng * 300 + 3) - 0.35) * 1.8);
}
const crimeSource = () => (hotspots.length ? 'hotspot file' : 'simulated (demo data)');
module.exports = { crimeIndex, crimeSource };
