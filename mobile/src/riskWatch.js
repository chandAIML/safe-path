// Predictive alerts: while ON, SafePath checks the danger level of where you are walking (time of day, darkness, lighting, crowd,
// crime layer, user reports) every ~150 m and warns you BEFORE you walk deeper into a risky area, with the nearest help.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Vibration } from 'react-native';
import * as Location from 'expo-location';
import { api } from './api';
import { dist } from './geo';
import { fmtDist, TYPE_LABEL } from './util';

export function alertText(r) {
  const why = (r.point.why || []).map((w) => w.text).join(', ') || 'higher risk expected';
  const help = (r.zones || []).find((z) => ['P', 'H', 'G', 'S'].includes(z.t));
  return `Risky area: ${why}.` + (help ? ` Nearest help: ${help.n || TYPE_LABEL[help.t]} (${fmtDist(help.dist)}).` : '');
}

export function useRiskWatch({ demoHour, onAlert }) {
  const [on, setOn] = useState(false), [last, setLast] = useState(null), [msg, setMsg] = useState('');
  const sub = useRef(null), at = useRef(null), prev = useRef('low'), busy = useRef(false);
  const hourRef = useRef(demoHour), cb = useRef(onAlert);
  hourRef.current = demoHour; cb.current = onAlert;

  const check = useCallback(async (loc) => {
    if (busy.current) return; busy.current = true;
    try {
      const here = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      if (at.current && dist(at.current, here) < 150) return;
      at.current = here;
      const body = { lat: here.latitude, lng: here.longitude }; if (hourRef.current != null) body.hour = hourRef.current;
      const r = await api('POST', '/risk/point', body); setLast(r);
      const lvl = r.point.level;
      if ((lvl === 'high' || lvl === 'medium') && prev.current !== lvl) { Vibration.vibrate([0, 250, 120, 250]); cb.current(alertText(r), lvl); }
      prev.current = lvl;
    } catch (e) { setMsg(e.message); } finally { busy.current = false; }
  }, []);

  const toggle = useCallback(async () => {
    if (sub.current) { sub.current.remove(); sub.current = null; setOn(false); return; }
    const p = await Location.requestForegroundPermissionsAsync();
    if (p.status !== 'granted') return setMsg('Allow location to use risk alerts.');
    at.current = null; prev.current = 'low'; setMsg('');
    sub.current = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, distanceInterval: 50, timeInterval: 15000 }, check);
    setOn(true);
  }, [check]);

  useEffect(() => () => { if (sub.current) sub.current.remove(); }, []);
  return { on, last, msg, toggle };
}
