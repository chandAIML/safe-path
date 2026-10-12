// Accepts 98765 43210, +91 98765 43210, 098765 43210 -> "9876543210" (or null if invalid)
export const ph = (v) => {
  v = String(v || '').replace(/[\s-]/g, '').replace(/^(\+91|91|0)(?=\d{10}$)/, '');
  return /^[6-9]\d{9}$/.test(v) ? v : null;
};
export const RELATIONS = ['Mother', 'Father', 'Friend', 'Sibling', 'Husband', 'Other'];
export const fmtPhone = (p) => (/^\d{10}$/.test(String(p)) ? '+91 ' + p : String(p));
export const fmtDist = (m) => (m >= 1000 ? (m / 1000).toFixed(1) + ' km' : Math.round(m / 10) * 10 + ' m');
export const fmtSize = (b) => (b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.round(b / 1024) + ' KB');
export const fmtTime = (t) => new Date(t).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
// score 0..100 -> words + colour (colours chosen to be readable on white)
export const scoreInfo = (s) => (s >= 75 ? { label: 'Safe', color: '#1B8A3A' } : s >= 50 ? { label: 'Be careful', color: '#B25E09' } : { label: 'High risk', color: '#D92D20' });
export const TYPE_COLOR = { P: '#2B59D9', H: '#D92D20', G: '#B25E09', T: '#7A3FD1', S: '#0E8A7D', C: '#8A5A2B', F: '#6B7684' };
export const TYPE_LABEL = { P: 'Police station', H: 'Hospital / pharmacy', G: 'Petrol bunk', T: 'Metro / railway / bus station', S: '24-hour store', C: 'Crowded public place', F: 'Shop / food' };
