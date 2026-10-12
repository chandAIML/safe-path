// Current position, but never wait forever: 8 s limit, then the last known position.
import * as Location from 'expo-location';

export async function getPosition(ms = 8000) {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== 'granted') throw Object.assign(new Error('Allow location access so SafePath can use where you are.'), { friendly: true });
  let p = null;
  try { p = await Promise.race([Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]); } catch (e) { /* try last known */ }
  if (!p) { try { p = await Location.getLastKnownPositionAsync(); } catch (e) { /* none */ } }
  if (!p) throw Object.assign(new Error('Couldn’t get your location. Turn on Location (GPS) in phone settings and try near a window.'), { friendly: true });
  return { lat: p.coords.latitude, lng: p.coords.longitude };
}
