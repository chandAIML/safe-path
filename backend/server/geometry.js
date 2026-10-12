// Plain geometry helpers (metres).
const R = 6371000, rad = Math.PI / 180;
const dist = (a, b) => {                                  // a, b = {lat, lng}
  const dLa = (b.lat - a.lat) * rad, dLo = (b.lng - a.lng) * rad;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
function toXY(p, o) { return { x: (p.lng - o.lng) * rad * R * Math.cos(o.lat * rad), y: (p.lat - o.lat) * rad * R }; }
function distToSegment(p, a, b) {                         // distance from point p to segment a-b
  const A = toXY(a, p), B = toXY(b, p), dx = B.x - A.x, dy = B.y - A.y, len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, -(A.x * dx + A.y * dy) / len2)) : 0;
  return Math.hypot(A.x + t * dx, A.y + t * dy);
}
// Points along a route every `step` metres: [{lat, lng, d}] (d = metres from the start)
function resample(pts, step = 120) {
  const out = [{ ...pts[0], d: 0 }]; let acc = 0, next = step;
  for (let i = 1; i < pts.length; i++) {
    const seg = dist(pts[i - 1], pts[i]);
    while (acc + seg >= next) {
      const f = (next - acc) / seg;
      out.push({ lat: pts[i - 1].lat + (pts[i].lat - pts[i - 1].lat) * f, lng: pts[i - 1].lng + (pts[i].lng - pts[i - 1].lng) * f, d: next });
      next += step;
    }
    acc += seg;
  }
  const last = pts[pts.length - 1];
  if (out[out.length - 1].d < acc - 1) out.push({ ...last, d: acc });
  return out;
}
const thin = (pts, max) => { const k = Math.max(1, Math.ceil(pts.length / max)); return pts.filter((_, i) => i % k === 0 || i === pts.length - 1); };
module.exports = { dist, distToSegment, resample, thin };
