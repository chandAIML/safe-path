// Place search (Nominatim, backup Photon) and road routes (OSRM, backup server).
const { URLS } = require('./config');
const { getJSON, firstOk, UA } = require('./http');

async function nominatim(q, near) {
  const vb = near ? `&viewbox=${near.lng - 0.5},${near.lat + 0.5},${near.lng + 0.5},${near.lat - 0.5}` : '';
  const g = await getJSON(`${URLS.nominatim}/search?format=json&limit=1&countrycodes=in${vb}&q=${encodeURIComponent(q)}`, { headers: UA }, 10000);
  return g.length ? { lat: +g[0].lat, lng: +g[0].lon, name: g[0].display_name } : null;
}
async function photon(q, near) {
  const bias = near ? `&lat=${near.lat}&lon=${near.lng}` : '';
  const g = await getJSON(`${URLS.photon}/api/?q=${encodeURIComponent(q)}&limit=1${bias}`, {}, 10000);
  const f = g.features && g.features[0];
  return f ? { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], name: (f.properties && f.properties.name) || q } : null;
}
// null = not found by any service; throws only when every service failed
async function geocode(q, near) {
  let errors = 0, last = null;
  for (const fn of [nominatim, photon]) { try { const r = await fn(q, near); if (r) return r; } catch (e) { errors++; last = e; } }
  if (errors === 2) throw last;
  return null;
}
async function routesBetween(from, to) {
  return firstOk(URLS.osrm, async (host) => {
    const o = await getJSON(`${host}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?alternatives=true&overview=full&geometries=geojson`, {}, 15000);
    if (!o.routes || !o.routes.length) throw new Error('No road route found.');
    return o.routes.slice(0, 3).map((r) => ({ pts: r.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })), min: Math.max(1, Math.round(r.duration / 60)), km: +(r.distance / 1000).toFixed(1) }));
  });
}
module.exports = { geocode, routesBetween };
