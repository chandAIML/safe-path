// Trains the route-risk model (logistic regression) and saves ml/risk_model.json.
//   node ml/train_risk.js                      -> trains on SYNTHETIC data (no public geotagged crime dataset is available)
//   put ml/data/training.csv  (columns: dark,lateNight,unlit,lowCrowd,roadIso,helpFar,crime,reports,rain,label) -> trains on REAL data instead
const fs = require('fs'), path = require('path');
const { NAMES, vector, sigmoid } = require('./features');

let seed = 42;                                         // reproducible random numbers
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
const clamp = (x) => Math.max(0, Math.min(1, x));

// "Expert prior": how much each factor should raise the danger. Used ONLY to generate synthetic labels.
const TRUE_W = [0.7, 0.6, 0.9, 0.8, 0.6, 0.5, 1.3, 1.5, 0.3, 1.0, 0.9], TRUE_B = -4.2;

function synthetic(n) {
  const rows = [];
  for (let i = 0; i < n; i++) {
    const night = rnd() < 0.45, dark = night ? 1 : (rnd() < 0.1 ? 0.5 : 0);
    const lateNight = night && rnd() < 0.45 ? 1 : 0;
    const lit = clamp((rnd() < 0.5 ? 0.75 : 0.25) + 0.3 * gauss() * 0.5);
    const crowd = clamp((dark ? 0.25 : 0.65) + 0.35 * gauss() * 0.6 - lateNight * 0.15);
    const f = { dark, lateNight, lit, crowd, roadIso: rnd() < 0.5 ? 0 : [0.4, 0.7, 1][Math.floor(rnd() * 3)], helpFar: clamp(rnd() * rnd() * 1.4),
      crime: clamp(Math.pow(rnd(), 2.2)), reports: rnd() < 0.8 ? 0 : clamp(0.3 + 0.7 * rnd()), rain: rnd() < 0.1 ? 1 : 0 };
    const x = vector(f), z = x.reduce((s, v, k) => s + v * TRUE_W[k], TRUE_B) + 0.35 * gauss();
    rows.push({ x, y: rnd() < sigmoid(z) ? 1 : 0 });
  }
  return rows;
}
function fromCsv(file) {
  const [head, ...lines] = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/);
  const cols = head.split(',').map((s) => s.trim());
  return lines.map((l) => { const v = l.split(',').map(Number), o = {}; cols.forEach((c, i) => (o[c] = v[i]));
    return { x: vector({ dark: o.dark, lateNight: o.lateNight, lit: 1 - o.unlit, crowd: 1 - o.lowCrowd, roadIso: o.roadIso, helpFar: o.helpFar, crime: o.crime, reports: o.reports, rain: o.rain }), y: o.label }; });
}

function auc(scores, ys) {                              // probability a random positive is ranked above a random negative
  const pairs = scores.map((s, i) => [s, ys[i]]).sort((a, b) => a[0] - b[0]);
  let rank = 0, pos = 0, neg = 0;
  pairs.forEach(([, y], i) => { if (y) { rank += i + 1; pos++; } else neg++; });
  return (rank - (pos * (pos + 1)) / 2) / (pos * neg);
}

function train(rows) {
  const k = rows[0].x.length, mean = Array(k).fill(0), std = Array(k).fill(0);
  rows.forEach((r) => r.x.forEach((v, j) => (mean[j] += v / rows.length)));
  rows.forEach((r) => r.x.forEach((v, j) => (std[j] += (v - mean[j]) ** 2 / rows.length)));
  std.forEach((v, j) => (std[j] = Math.sqrt(v) || 1));
  const cut = Math.floor(rows.length * 0.8), tr = rows.slice(0, cut), te = rows.slice(cut);
  const z = (x) => x.map((v, j) => (v - mean[j]) / std[j]);
  const Z = tr.map((r) => z(r.x));
  let w = Array(k).fill(0), b = 0;
  const lr = 0.3, l2 = 1e-3;
  for (let ep = 0; ep < 500; ep++) {                    // batch gradient descent
    const gw = Array(k).fill(0); let gb = 0;
    Z.forEach((x, i) => { const e = sigmoid(x.reduce((s, v, j) => s + v * w[j], b)) - tr[i].y; x.forEach((v, j) => (gw[j] += e * v)); gb += e; });
    w = w.map((v, j) => v - lr * (gw[j] / Z.length + l2 * v)); b -= lr * gb / Z.length;
  }
  const predict = (x) => sigmoid(z(x).reduce((s, v, j) => s + v * w[j], b));
  const sc = te.map((r) => predict(r.x)), ys = te.map((r) => r.y);
  const acc = sc.reduce((s, p, i) => s + ((p >= 0.5 ? 1 : 0) === ys[i] ? 1 : 0), 0) / te.length;
  const base = Math.max(ys.filter(Boolean).length, ys.length - ys.filter(Boolean).length) / ys.length;
  return { mean, std, w, b, test: { n: te.length, accuracy: +acc.toFixed(3), auc: +auc(sc, ys).toFixed(3), majorityBaseline: +base.toFixed(3) } };
}

const csv = path.join(__dirname, 'data', 'training.csv');
const real = fs.existsSync(csv), rows = real ? fromCsv(csv) : synthetic(30000);
const m = train(rows);
// fold the standardisation into the weights, so the server only needs  logit = b' + sum(w'[i] * x[i])
const ew = m.w.map((v, j) => v / m.std[j]);
const model = { trainedOn: real ? 'csv (real data)' : 'synthetic data (expert-prior simulator)', samples: rows.length, features: NAMES, weights: ew.map((v) => +v.toFixed(4)),
  bias: +(m.b - m.w.reduce((s, v, j) => s + (v * m.mean[j]) / m.std[j], 0)).toFixed(4), test: m.test, trainedAt: new Date().toISOString() };
fs.writeFileSync(path.join(__dirname, 'risk_model.json'), JSON.stringify(model, null, 2));
console.log('Risk model saved. Trained on', model.trainedOn, '| test accuracy', m.test.accuracy, '| AUC', m.test.auc, '| majority baseline', m.test.majorityBaseline);
console.log('Learned weights:', NAMES.map((n, i) => `${n}=${model.weights[i]}`).join('  '));
