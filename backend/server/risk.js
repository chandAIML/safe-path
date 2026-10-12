// Route risk prediction. For every ~120 m of a route we collect 9 facts (darkness, street lighting, crowd, isolation, distance to help,
// crime density, user reports, weather), feed them to the trained logistic-regression model (ml/risk_model.json), and get a danger
// probability. Route safety score = 100 x (1 - risk). Segments with high danger become "predictive alerts" shown BEFORE the user gets there.
const model = require('../ml/risk_model.json');
const { vector, sigmoid, NAMES } = require('../ml/features');
const { dist, distToSegment, resample } = require('./geometry');
const { HELP, CROWD_WEIGHT, LABEL } = require('./poi');
const { crimeIndex } = require('./crime');

const clamp = (x) => Math.max(0, Math.min(1, x));
// fraction of people who are out and about, by hour of day
const ACTIVITY = [0.15, 0.1, 0.1, 0.1, 0.15, 0.3, 0.6, 0.85, 0.95, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0.95, 0.8, 0.65, 0.5, 0.35, 0.22];
const activity = (h) => { const i = Math.floor(h) % 24, f = h - Math.floor(h); return ACTIVITY[i] + (ACTIVITY[(i + 1) % 24] - ACTIVITY[i]) * f; };
// when OpenStreetMap has no "lit" tag (common in India) we estimate lighting from the road type
const CLASS_LIT = { motorway: 0.8, trunk: 0.8, primary: 0.75, secondary: 0.7, tertiary: 0.55, residential: 0.4, living_street: 0.4, unclassified: 0.25, service: 0.25, track: 0.1, path: 0.1, footway: 0.2, pedestrian: 0.4, cycleway: 0.15 };
const CLASS_ISO = { motorway: 0, trunk: 0, primary: 0, secondary: 0, tertiary: 0.15, residential: 0.4, living_street: 0.4, unclassified: 0.6, service: 0.7, track: 1, path: 1, footway: 0.6, pedestrian: 0.2, cycleway: 0.8 };

const HOT = 0.5, WARN = 0.35;      // danger probability at which a segment is "high" / "medium"

function darkness(hour, sun) {
  const rise = sun && sun.rise != null ? sun.rise : 6, set = sun && sun.set != null ? sun.set : 18.25;
  if (hour < rise - 0.5 || hour > set + 0.5) return 1;
  if (hour > rise + 0.5 && hour < set - 0.5) return 0;
  return 0.5;
}
const lateNight = (h) => (h >= 22.5 || h < 5 ? 1 : 0);
const predict = (x) => sigmoid(model.bias + x.reduce((s, v, i) => s + v * model.weights[i], 0));

function nearestWay(p, ways) {
  let best = null, bd = 45;
  for (const w of ways) for (let i = 1; i < w.geom.length; i++) {
    const d = distToSegment(p, w.geom[i - 1], w.geom[i]);
    if (d < bd) { bd = d; best = w; }
  }
  return best;
}
function reportWeight(reports, p, now) {
  let w = 0, n = 0;
  for (const r of reports) if (dist(p, r) <= 200) { n++; w += Math.exp(-(now - r.at) / (60 * 864e5)); }
  return { score: 1 - Math.exp(-w / 1.5), n };
}

// context = { hour, sun:{rise,set}, rain:0|1, reports:[{lat,lng,at}], now }
function segmentFeatures(p, osm, ctx) {
  const way = nearestWay(p, osm.ways), tags = way ? way.tags : {}, hw = tags.highway;
  const lit = tags.lit === 'yes' || tags.lit === '24/7' || tags.lit === 'automatic' ? { v: 1, known: true } : tags.lit === 'no' || tags.lit === 'disused' ? { v: 0, known: true } : { v: CLASS_LIT[hw] != null ? CLASS_LIT[hw] : 0.3, known: false };
  const roadIso = CLASS_ISO[hw] != null ? CLASS_ISO[hw] : 0.5;
  let crowdW = 0, help = null;
  for (const q of osm.pois) {
    const d = dist(p, q);
    if (d <= 120) crowdW += CROWD_WEIGHT[q.t] || 1;
    if (HELP.has(q.t) && (!help || d < help.d)) help = { d, n: q.n, t: q.t };
  }
  const crowdRaw = clamp(crowdW / 6);
  const crowd = clamp((0.25 * (1 - roadIso) + 0.75 * crowdRaw) * activity(ctx.hour));
  const helpD = help ? help.d : 1500;
  const rep = reportWeight(ctx.reports, p, ctx.now);
  return { dark: darkness(ctx.hour, ctx.sun), lateNight: lateNight(ctx.hour), lit: lit.v, litKnown: lit.known, crowd, crowdRaw, roadIso,
    helpFar: clamp(helpD / 1500), helpDist: Math.round(helpD), helpName: help ? help.n : '', helpType: help ? help.t : null,
    crime: crimeIndex(p.lat, p.lng), reports: rep.score, reportCount: rep.n, rain: ctx.rain ? 1 : 0, road: hw || 'unknown' };
}

// Why is this segment risky? Group the model's contributions into plain-language reasons.
function reasons(f, x) {
  const c = {}; NAMES.forEach((n, i) => (c[n] = model.weights[i] * x[i]));
  const groups = [
    { k: 'light', v: c.unlit + c['dark x unlit'], t: f.dark ? 'poor street lighting after dark' : 'poor street lighting' },
    { k: 'crowd', v: c.lowCrowd + c['dark x lowCrowd'], t: 'few people around' },
    { k: 'night', v: c.dark + c.lateNight, t: f.lateNight ? 'late at night' : 'it is dark' },
    { k: 'isolation', v: c.roadIso + c.helpFar, t: 'isolated road, far from help' },
    { k: 'crime', v: c.crime, t: 'higher crime-density area' },
    { k: 'reports', v: c.reports, t: `${f.reportCount} recent user report${f.reportCount === 1 ? '' : 's'} nearby` },
    { k: 'weather', v: c.rain, t: 'bad weather' },
  ];
  return groups.filter((g) => g.v > 0.25).sort((a, b) => b.v - a.v).slice(0, 3).map((g) => ({ key: g.k, text: g.t }));
}
const avg = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const quantile = (a, q) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0; };
const meters = (m) => (m >= 1000 ? (m / 1000).toFixed(1) + ' km' : Math.round(m / 10) * 10 + ' m');

function analyzeRoute(route, osm, ctx) {
  const samples = resample(route.pts, 120);
  const segs = samples.map((s) => { const f = segmentFeatures(s, osm, ctx), x = vector(f), p = predict(x); return { ...s, f, p, why: reasons(f, x) }; });
  const ps = segs.map((s) => s.p), risk = 0.65 * avg(ps) + 0.35 * quantile(ps, 0.9), total = segs[segs.length - 1].d || 1;

  const alerts = [], hot = []; let run = null;
  segs.forEach((s, i) => {
    if (s.p >= WARN) { if (!run) run = { from: i, max: s }; if (s.p > run.max.p) run.max = s; }
    if ((s.p < WARN || i === segs.length - 1) && run) {
      const to = s.p < WARN ? i - 1 : i, w = run.max, level = w.p >= 0.65 ? 'high' : w.p >= HOT ? 'medium' : 'low';
      if (level !== 'low') {
        const help = w.f.helpName ? `Nearest help: ${w.f.helpName} (${meters(w.f.helpDist)})` : w.f.helpType ? `Nearest help: ${LABEL[w.f.helpType]} (${meters(w.f.helpDist)})` : '';
        const where = segs[run.from];
        alerts.push({ lat: where.lat, lng: where.lng, at: where.d, level, risk: +w.p.toFixed(2), len: Math.round(segs[to].d - where.d),
          text: `${meters(where.d)} from start: ${w.why.map((r) => r.text).join(', ') || 'higher risk expected'}.` + (help ? ' ' + help : '') });
        hot.push(segs.slice(Math.max(0, run.from - 1), to + 2).map((q) => [+q.lat.toFixed(5), +q.lng.toFixed(5)]));
      }
      run = null;
    }
  });
  const F = (k) => avg(segs.map((s) => s.f[k]));
  const reportIds = new Set(); // distinct nearby reports along the whole route
  ctx.reports.forEach((r) => { if (segs.some((s) => dist(s, r) <= 200)) reportIds.add(r.id || `${r.lat},${r.lng}`); });
  return {
    score: Math.round(100 * (1 - risk)), risk: +risk.toFixed(3), segments: segs.length,
    factors: { lighting: +F('lit').toFixed(2), crowd: +F('crowd').toFixed(2), isolation: +avg(segs.map((s) => 0.5 * (1 - s.f.crowdRaw) + 0.3 * s.f.roadIso + 0.2 * s.f.helpFar)).toFixed(2),
      crime: +F('crime').toFixed(2), reports: reportIds.size, litKnownPct: Math.round(100 * avg(segs.map((s) => (s.f.litKnown ? 1 : 0)))), avgHelpM: Math.round(F('helpDist')) },
    alerts, hot, total, samples: segs,
  };
}

// Danger right at one spot (for the "area risk now" card and walking alerts)
function analyzePoint(p, osm, ctx) {
  const f = segmentFeatures(p, osm, ctx), x = vector(f), pr = predict(x);
  return { score: Math.round(100 * (1 - pr)), risk: +pr.toFixed(3), level: pr >= 0.65 ? 'high' : pr >= HOT ? 'medium' : pr >= WARN ? 'caution' : 'low',
    why: reasons(f, x), factors: { dark: f.dark, lit: +f.lit.toFixed(2), litKnown: f.litKnown, crowd: +f.crowd.toFixed(2), crime: +f.crime.toFixed(2), reports: f.reportCount, road: f.road }, help: f.helpType ? { type: f.helpType, name: f.helpName, dist: f.helpDist } : null };
}
module.exports = { analyzeRoute, analyzePoint, darkness, activity, predict, model, HOT, WARN, meters };
