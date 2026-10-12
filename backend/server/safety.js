// Route planning with risk prediction, "risk right here", and the safe-zone list.
const express = require('express');
const { requireAuth } = require('./auth');
const geo = require('./geo'), overpass = require('./overpass'), risk = require('./risk');
const { weatherAt, istNow } = require('./weather');
const { Report } = require('./db');
const { crimeSource } = require('./crime');
const { dist, thin } = require('./geometry');
const { LABEL } = require('./poi');
const { nearbyZones } = require('./zones');
const router = express.Router();

const num = (v, lo, hi) => (typeof v === 'number' && v >= lo && v <= hi ? v : null);
const pt = (o) => (o ? { lat: num(o.lat, -90, 90), lng: num(o.lng, -180, 180) } : null);
const ok = (p) => p && p.lat !== null && p.lng !== null;

async function loadReports(b) {
  const rows = await Report.find({ lat: { $gte: b.s, $lte: b.n }, lng: { $gte: b.w, $lte: b.e } }).limit(500);
  return rows.map((r) => ({ id: r.id, lat: r.lat, lng: r.lng, at: r.at, type: r.type }));
}
async function context(center, hourOverride, bbox) {
  const wx = await weatherAt(center.lat, center.lng);
  const hour = hourOverride !== null ? hourOverride : wx && wx.localHour != null ? wx.localHour : istNow();
  return { hour, wx, sun: wx ? { rise: wx.sunrise, set: wx.sunset } : null, rain: wx && wx.bad ? 1 : 0, reports: await loadReports(bbox).catch(() => []), now: Date.now() };
}
const hourLabel = (h) => { const hh = Math.floor(h), mm = Math.round((h - hh) * 60); return `${((hh + 11) % 12) + 1}:${String(mm % 60).padStart(2, '0')} ${hh >= 12 ? 'PM' : 'AM'}`; };

router.post('/route/plan', requireAuth, async (req, res) => {
  const b = req.body || {}, from = pt(b.from);
  if (!ok(from)) return res.status(400).json({ error: 'Your location is needed to plan a route.' });
  let to = pt(b.to);
  if (!ok(to)) {
    const q = String(b.query || '').trim();
    if (q.length < 2) return res.status(400).json({ error: 'Enter a destination.' });
    let g; try { g = await geo.geocode(q, from); } catch (e) { return res.status(502).json({ error: 'Place search is not responding right now. Try again in a minute.', step: 'search' }); }
    if (!g) return res.status(404).json({ error: 'Couldn’t find that place. Try a more specific name, e.g. “Vizianagaram RTC bus stand”.' });
    to = g;
  }
  let rs; try { rs = await geo.routesBetween(from, to); } catch (e) { return res.status(502).json({ error: 'The route service is not responding. Try again in a minute.', step: 'routes' }); }

  let osm = { ways: [], pois: [] }, osmFailed = false;
  try { osm = await overpass.alongRoutes(rs.map((r) => r.pts)); } catch (e) { osmFailed = true; }
  const all = rs.flatMap((r) => r.pts), pad = 0.003;
  const bbox = { s: Math.min(...all.map((p) => p.lat)) - pad, n: Math.max(...all.map((p) => p.lat)) + pad, w: Math.min(...all.map((p) => p.lng)) - pad, e: Math.max(...all.map((p) => p.lng)) + pad };
  const ctx = await context(from, num(b.hour, 0, 23.99), bbox);

  const routes = rs.map((r) => {
    const a = risk.analyzeRoute(r, osm, ctx), pois = [], used = {};
    osm.pois.forEach((p) => {
      let best = null; for (const s of a.samples) { const d = dist(s, p); if (d <= 200 && (!best || d < best.d)) best = { d, f: s.d / a.total }; }
      if (best) pois.push({ lat: p.lat, lng: p.lng, t: p.t, n: p.n, label: LABEL[p.t], f: +best.f.toFixed(3) });
    });
    pois.sort((x, y) => x.f - y.f);
    return { min: r.min, km: r.km, score: a.score, risk: a.risk, factors: a.factors, alerts: a.alerts, hot: a.hot,
      pts: thin(r.pts, 400).map((p) => [+p.lat.toFixed(5), +p.lng.toFixed(5)]),
      pois: pois.filter((p) => (used[p.t] = (used[p.t] || 0) + 1) <= 12).slice(0, 60) };
  });
  let si = 0, fi = 0; routes.forEach((r, i) => { if (r.score > routes[si].score) si = i; if (r.min < routes[fi].min) fi = i; });
  routes.forEach((r, i) => {
    if (i === si && i === fi) { r.name = 'Fastest and safest'; r.color = '#1B8A3A'; }
    else if (i === si) { r.name = 'Safest'; r.color = '#1B8A3A'; }
    else if (i === fi) { r.name = 'Fastest'; r.color = '#E08A00'; }
    else { r.name = 'Alternative'; r.color = '#2B59D9'; }
  });
  const notes = [];
  if (osmFailed) notes.push('Road and nearby-place data could not be loaded, so scores use default values. Try again in a minute.');
  else if (routes[si].factors.litKnownPct < 30) notes.push('Street-light data is limited in OpenStreetMap here, so lighting is estimated from the road type.');
  notes.push(`Crime layer: ${crimeSource()}.`);
  res.json({ best: si, routes, notes, to: { lat: to.lat, lng: to.lng },
    meta: { hour: ctx.hour, hourLabel: hourLabel(ctx.hour), dark: risk.darkness(ctx.hour, ctx.sun), simulatedTime: b.hour != null, weather: ctx.wx && { tempC: ctx.wx.tempC, condition: ctx.wx.condition, bad: ctx.wx.bad, sunrise: ctx.wx.sunrise, sunset: ctx.wx.sunset },
      reportsNearby: new Set(ctx.reports.map((r) => r.id)).size, model: { trainedOn: risk.model.trainedOn, accuracy: risk.model.test.accuracy, auc: risk.model.test.auc } } });
});

// Danger right here, right now (used by the "Area safety" card and walking alerts)
router.post('/risk/point', requireAuth, async (req, res) => {
  const p = pt(req.body);
  if (!ok(p)) return res.status(400).json({ error: 'Location needed.' });
  let osm = { ways: [], pois: [] }; try { osm = await overpass.alongRoutes([[p]]); } catch (e) { /* defaults */ }
  const d = 0.004, ctx = await context(p, num(req.body.hour, 0, 23.99), { s: p.lat - d, n: p.lat + d, w: p.lng - d, e: p.lng + d });
  const point = risk.analyzePoint(p, osm, ctx);
  let zones = []; try { zones = (await nearbyZones(p.lat, p.lng, 1500)).slice(0, 6); } catch (e) { /* optional */ }
  res.json({ point, zones, hourLabel: hourLabel(ctx.hour), simulatedTime: req.body.hour != null, weather: ctx.wx && { tempC: ctx.wx.tempC, condition: ctx.wx.condition, bad: ctx.wx.bad }, dark: risk.darkness(ctx.hour, ctx.sun), crime: crimeSource() });
});

router.get('/safezones', requireAuth, async (req, res) => {
  const lat = parseFloat(req.query.lat), lng = parseFloat(req.query.lng), radius = Math.min(5000, Math.max(300, +req.query.radius || 1500));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return res.status(400).json({ error: 'Location needed.' });
  let zones; try { zones = await nearbyZones(lat, lng, radius); } catch (e) { return res.status(502).json({ error: 'The places service is not responding. Try again in a minute.' }); }
  const want = req.query.type ? String(req.query.type).split(',') : null;
  if (want) zones = zones.filter((z) => want.includes(z.t));
  const counts = {}; zones.forEach((z) => (counts[z.t] = (counts[z.t] || 0) + 1));
  res.json({ zones: zones.slice(0, 80), counts, labels: LABEL, radius });
});
module.exports = { router };
