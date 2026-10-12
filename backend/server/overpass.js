// OpenStreetMap data through the free Overpass API: roads (with lighting tags) and places along a route.
const { URLS } = require('./config');
const { getJSON, firstOk, UA } = require('./http');
const { cached, hash } = require('./cache');
const { thin } = require('./geometry');
const { classify } = require('./poi');

const run = (q) => firstOk(URLS.overpass, (u) => getJSON(u, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...UA }, body: 'data=' + encodeURIComponent(q) }, 28000));
const poly = (pts) => thin(pts, 50).map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(',');
const AM = 'police|hospital|clinic|doctors|pharmacy|restaurant|fast_food|cafe|fuel|bank|atm|bus_station|marketplace|cinema|theatre|place_of_worship';

// routes = [[{lat,lng},...], ...]  ->  { ways:[{id,tags,geom}], pois:[{id,t,n,lat,lng}] }
function alongRoutes(routes) {
  return cached('route:' + hash(routes.map(poly).join('|')), 6 * 3600e3, async () => {
    const ways = routes.map((r) => `way["highway"](around:60,${poly(r)});`).join('');
    const pois = routes.map((r) => { const p = poly(r);
      return `node["amenity"~"^(${AM})$"](around:250,${p});node["shop"](around:250,${p});node["highway"="bus_stop"](around:250,${p});` +
             `node["railway"~"^(station|halt|subway_entrance)$"](around:250,${p});node["public_transport"="station"](around:250,${p});`; }).join('');
    const j = await run(`[out:json][timeout:25];(${ways});out tags geom;(${pois});out tags;`);
    const w = [], p = [], seen = new Set();
    for (const e of j.elements || []) {
      if (e.type === 'way' && e.geometry) w.push({ id: e.id, tags: e.tags || {}, geom: e.geometry.map((g) => ({ lat: g.lat, lng: g.lon })) });
      else if (e.type === 'node' && !seen.has(e.id)) {
        seen.add(e.id); const t = classify(e.tags || {});
        if (t) p.push({ id: e.id, t, n: (e.tags && e.tags.name) || '', lat: e.lat, lng: e.lon, h24: (e.tags || {}).opening_hours === '24/7' });
      }
    }
    return { ways: w, pois: p };
  });
}

// Places that can help (police, hospitals, stations...) around a point. Cached per ~2 km cell = our "safe-zone database".
function zonesAround(lat, lng, radius) {
  const cl = Math.round(lat * 50) / 50, cn = Math.round(lng * 50) / 50, R = radius + 1500;
  return cached(`zones:${cl}:${cn}:${radius}`, 24 * 3600e3, async () => {
    const c = `(around:${R},${cl},${cn})`;
    const q = `[out:json][timeout:25];(nwr["amenity"~"^(police|hospital|clinic|pharmacy|fuel|bus_station|marketplace|cinema|theatre|place_of_worship)$"]${c};` +
      `nwr["shop"~"^(mall|supermarket|department_store|convenience)$"]${c};nwr["railway"~"^(station|halt|subway_entrance)$"]${c};` +
      `nwr["public_transport"="station"]${c};nwr["opening_hours"="24/7"]["shop"]${c};nwr["opening_hours"="24/7"]["amenity"]${c};);out center tags 500;`;
    const j = await run(q), out = [], seen = new Set();
    for (const e of j.elements || []) {
      const la = e.lat !== undefined ? e.lat : e.center && e.center.lat, lo = e.lon !== undefined ? e.lon : e.center && e.center.lon;
      const key = e.type + e.id; if (la === undefined || seen.has(key)) continue; seen.add(key);
      const t = classify(e.tags || {}); if (t) out.push({ id: key, t, n: (e.tags && (e.tags.name || e.tags['name:en'])) || '', lat: la, lng: lo, h24: (e.tags || {}).opening_hours === '24/7', phone: (e.tags || {}).phone || (e.tags || {})['contact:phone'] || '' });
    }
    return out;
  });
}
module.exports = { alongRoutes, zonesAround };
