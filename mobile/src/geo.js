// Distance between two {latitude, longitude} points, in metres.
export function dist(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const dLa = (b.latitude - a.latitude) * rad, dLo = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export const P = (a) => ({ latitude: a[0], longitude: a[1] });      // [lat, lng] -> {latitude, longitude}
