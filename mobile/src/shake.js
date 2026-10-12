// Shake the phone hard 4 times -> SOS countdown (while the app is open).
import { useEffect } from 'react';
import { SensorsMod } from './native';

export const shakeSupported = !!SensorsMod;
export function useShake(enabled, onShake) {
  useEffect(() => {
    if (!enabled || !SensorsMod) return;
    const { Accelerometer } = SensorsMod;
    Accelerometer.setUpdateInterval(100);
    let hits = [];
    const sub = Accelerometer.addListener(({ x, y, z }) => {
      if (Math.sqrt(x * x + y * y + z * z) > 2.7) {
        const t = Date.now(); hits = hits.filter((h) => t - h < 1500); hits.push(t);
        if (hits.length >= 4) { hits = []; onShake(); }
      }
    });
    return () => sub.remove();
  }, [enabled, onShake]);
}
