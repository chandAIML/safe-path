// Safe route: 2-3 road routes, each scored by the AI risk model (lighting, crowd, crime layer, user reports, time of day, weather),
// risky stretches in red, predictive alerts BEFORE you reach them, safe places along the way.
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Vibration, Switch } from 'react-native';
import { Page, H1, Sub, Err, Field, Btn, Link, Card, Bar } from '../ui';
import OSMap from '../OSMap';
import { C } from '../theme';
import { api } from '../api';
import { getPosition } from '../location';
import { dist, P } from '../geo';
import { scoreInfo, fmtDist } from '../util';
import * as Location from 'expo-location';

const fmtWx = (m) => `${m.hourLabel}${m.simulatedTime ? ' (simulated)' : ''} · ${m.dark === 1 ? 'Dark' : m.dark === 0.5 ? 'Twilight' : 'Daylight'}${m.weather ? ` · ${m.weather.condition}, ${Math.round(m.weather.tempC)}°C` : ''}`;

export default function RouteScreen({ onBack, demoHour }) {
  const [dest, setDest] = useState('');
  const [busy, setBusy] = useState(false), [stage, setStage] = useState(''), [err, setErr] = useState('');
  const [plan, setPlan] = useState(null), [sel, setSel] = useState(0), [me, setMe] = useState(null);
  const [banner, setBanner] = useState(null), [running, setRunning] = useState(false);
  const watch = useRef(null), sim = useRef(null), fired = useRef({}), bt = useRef(null);

  useEffect(() => () => { stop(); clearTimeout(bt.current); }, []);
  function stop() {
    if (watch.current) { watch.current.remove(); watch.current = null; }
    if (sim.current) { clearInterval(sim.current); sim.current = null; }
    setRunning(false);
  }
  function say(text, strong) { setBanner({ text, strong }); Vibration.vibrate(strong ? [0, 250, 120, 250] : 80); clearTimeout(bt.current); bt.current = setTimeout(() => setBanner(null), 6000); }

  async function find() {
    if (dest.trim().length < 2) return setErr('Enter a destination.');
    setErr(''); setBusy(true); stop(); setPlan(null); setMe(null);
    try {
      setStage('Getting your location…');
      const from = await getPosition();
      setStage('Finding routes and checking risk (lighting, crowd, crime, weather, reports)… this can take up to 30 seconds');
      const body = { from, query: dest.trim() }; if (demoHour != null) body.hour = demoHour;
      const r = await api('POST', '/route/plan', body, 70000);
      setPlan(r); setSel(r.best);
    } catch (e) { setErr(e.message); }
    setStage(''); setBusy(false);
  }

  const r = plan && plan.routes[sel];
  function handle(pos) {                                  // every new position (live GPS or demo drive)
    setMe(pos);
    r.alerts.forEach((a, i) => { if (!fired.current['a' + i] && dist(pos, P([a.lat, a.lng])) < 300) { fired.current['a' + i] = 1; say('⚠ Ahead: ' + a.text, true); } });
    r.pois.forEach((p, i) => { if (!fired.current['p' + i] && ['P', 'H', 'G', 'S'].includes(p.t) && dist(pos, P([p.lat, p.lng])) < 120) { fired.current['p' + i] = 1; say(`${p.label}${p.n ? ': ' + p.n : ''} nearby on your route`); } });
    if (dist(pos, P(r.pts[r.pts.length - 1])) < 50) { say('You reached your destination safely.'); stop(); }
  }
  async function startLive() {
    stop(); fired.current = {}; setRunning(true);
    watch.current = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 10 }, (l) => handle({ latitude: l.coords.latitude, longitude: l.coords.longitude }));
  }
  function startDemo() {
    stop(); fired.current = {}; setRunning(true);
    const by = Math.max(1, Math.ceil(r.pts.length / 60)); let i = 0;
    sim.current = setInterval(() => { i = Math.min(i + by, r.pts.length - 1); handle(P(r.pts[i])); if (i >= r.pts.length - 1) stop(); }, 500);
  }

  const light = (v) => (v >= 0.6 ? 'good' : v >= 0.35 ? 'average' : 'poor');
  return (
    <Page>
      <View style={{ marginTop: 8 }}><Link title="‹ Back" onPress={() => { stop(); onBack(); }} /></View>
      <H1 style={{ marginTop: 18 }}>Safe route</H1>
      <Sub>AI risk prediction for every route: time of day, lighting, crowd, crime, user reports and weather.</Sub>
      <Field label="Where to?" value={dest} onChangeText={setDest} placeholder="e.g. Vizianagaram RTC bus stand" returnKeyType="search" onSubmitEditing={find} />
      {demoHour != null && <Text style={{ color: C.warn, marginTop: 8, fontSize: 13 }}>Demo mode is ON: routes are scored as if it is 11 PM.</Text>}
      <Err>{err}</Err>
      <Btn title={busy ? 'Working…' : 'Find routes'} onPress={find} disabled={busy} />
      {busy && !!stage && <Text style={{ color: C.sub, marginTop: 10 }}>{stage}</Text>}

      {plan && r && (
        <>
          <Text style={{ color: C.sub, marginTop: 16, fontSize: 13 }}>{fmtWx(plan.meta)}</Text>
          <OSMap routes={plan.routes} sel={sel} me={me} />
          {!!banner && <View style={{ backgroundColor: banner.strong ? C.danger : C.text, borderRadius: 10, padding: 12, marginTop: 12 }}><Text style={{ color: '#fff', lineHeight: 20 }}>{banner.text}</Text></View>}
          {plan.routes.map((x, i) => {
            const s = scoreInfo(x.score);
            return (
              <Pressable key={i} onPress={() => { stop(); setSel(i); setMe(null); }}
                style={[{ backgroundColor: C.card, borderRadius: 12, borderWidth: 1.5, borderColor: C.line, borderLeftWidth: 6, borderLeftColor: x.color, padding: 12, marginTop: 10, flexDirection: 'row', alignItems: 'center' }, i === sel && { borderColor: x.color, backgroundColor: '#FAFBFD' }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: C.text, fontSize: 16 }}>{x.name}</Text>
                  <Text style={{ color: C.sub, fontSize: 13, marginTop: 2 }}>{x.min} min · {x.km} km · lighting {light(x.factors.lighting)} · crowd {light(x.factors.crowd)}</Text>
                  <Text style={{ color: x.alerts.length ? C.danger : C.ok, fontSize: 12, marginTop: 2 }}>{x.alerts.length ? `${x.alerts.length} risky stretch${x.alerts.length > 1 ? 'es' : ''}` : 'No risky stretch predicted'}</Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: s.color, fontWeight: '800', fontSize: 28 }}>{x.score}</Text>
                  <Text style={{ color: s.color, fontSize: 10, fontWeight: '700' }}>{s.label.toUpperCase()}</Text>
                </View>
              </Pressable>
            );
          })}

          <Card>
            <Text style={{ fontWeight: '700', color: C.text, fontSize: 15 }}>Why this score ({r.name})</Text>
            <Bar label="Street lighting" value={r.factors.lighting} color={C.ok} note={light(r.factors.lighting) + (r.factors.litKnownPct < 30 ? ' (estimated)' : '')} />
            <Bar label="Crowd / people around" value={r.factors.crowd} color={C.ok} note={light(r.factors.crowd)} />
            <Bar label="Isolation" value={r.factors.isolation} color={C.danger} note={r.factors.isolation > 0.6 ? 'high' : r.factors.isolation > 0.4 ? 'medium' : 'low'} />
            <Bar label="Crime density (demo data)" value={r.factors.crime} color={C.danger} note={r.factors.crime > 0.5 ? 'high' : r.factors.crime > 0.25 ? 'medium' : 'low'} />
            <Text style={{ color: C.sub, fontSize: 13, marginTop: 10 }}>User reports along this route: {r.factors.reports} · average distance to help: {fmtDist(r.factors.avgHelpM)}</Text>
          </Card>

          {r.alerts.length > 0 && (
            <Card style={{ borderColor: C.danger }}>
              <Text style={{ fontWeight: '700', color: C.danger, fontSize: 15 }}>Predictive alerts on this route</Text>
              {r.alerts.map((a, i) => <Text key={i} style={{ color: C.text, marginTop: 8, lineHeight: 20 }}>{a.level === 'high' ? '🔴' : '🟠'} {a.text}</Text>)}
            </Card>
          )}

          {running ? <Btn title="Stop journey" kind="danger" onPress={stop} /> : (
            <>
              <Btn title="Start journey (live GPS alerts)" onPress={startLive} />
              <Btn title="Demo drive (no need to move)" kind="outline" onPress={startDemo} />
            </>
          )}
          <Card>
            {plan.notes.map((n, i) => <Text key={i} style={{ color: C.sub, fontSize: 12, lineHeight: 18 }}>• {n}</Text>)}
            <Text style={{ color: C.sub, fontSize: 12, lineHeight: 18, marginTop: 4 }}>• Risk model: logistic regression trained on {plan.meta.model.trainedOn} (test accuracy {plan.meta.model.accuracy}, AUC {plan.meta.model.auc}). Real crime data can be added by the police / admin.</Text>
          </Card>
        </>
      )}
    </Page>
  );
}
