// Area safety: danger level right here (AI model), nearest safe places (police, hospital, metro/railway, petrol bunk, 24h store, crowded places),
// and a button to report an unsafe spot (reports lower the score of routes through it).
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Linking, TextInput } from 'react-native';
import { Page, H1, Sub, Err, Btn, Chip, Link, Card, Label } from '../ui';
import { C } from '../theme';
import { api } from '../api';
import { getPosition } from '../location';
import { scoreInfo, fmtDist, TYPE_COLOR, TYPE_LABEL } from '../util';

const REPORTS = [['harassment', 'Harassment'], ['poor_lighting', 'Poor lighting'], ['isolated', 'Isolated'], ['stalking', 'Stalking'], ['theft', 'Theft'], ['other', 'Other']];
const FILTERS = [['ALL', 'All'], ['P', 'Police'], ['H', 'Hospital'], ['T', 'Metro/Rail/Bus'], ['G', 'Petrol'], ['S', '24h store'], ['C', 'Crowded']];

export default function Safety({ onBack, demoHour }) {
  const [pos, setPos] = useState(null), [data, setData] = useState(null), [zones, setZones] = useState([]);
  const [filter, setFilter] = useState('ALL'), [err, setErr] = useState(''), [busy, setBusy] = useState(true);
  const [rtype, setRtype] = useState('harassment'), [note, setNote] = useState(''), [sent, setSent] = useState('');

  async function load() {
    setBusy(true); setErr('');
    try {
      const p = await getPosition(); setPos(p);
      const body = { ...p }; if (demoHour != null) body.hour = demoHour;
      setData(await api('POST', '/risk/point', body, 40000));
      const z = await api('GET', `/safezones?lat=${p.lat}&lng=${p.lng}&radius=2000`, null, 40000); setZones(z.zones);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  }
  useEffect(() => { load(); }, []);   // eslint-disable-line

  async function report() {
    try { await api('POST', '/reports', { ...pos, type: rtype, note }); setSent('Thank you. Routes through this spot will now score lower.'); setNote(''); load(); }
    catch (e) { setSent(e.message); }
  }
  const open = (z) => Linking.openURL(`geo:${z.lat},${z.lng}?q=${z.lat},${z.lng}(${encodeURIComponent(z.n || z.label)})`).catch(() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${z.lat},${z.lng}`));
  const s = data && scoreInfo(data.point.score), list = zones.filter((z) => filter === 'ALL' || z.t === filter);

  return (
    <Page>
      <View style={{ marginTop: 8 }}><Link title="‹ Back" onPress={onBack} /></View>
      <H1 style={{ marginTop: 18 }}>Area safety</H1>
      <Sub>How safe is the place you are in right now, and where the nearest help is.</Sub>
      {busy && <Text style={{ color: C.sub, marginTop: 16 }}>Checking your area (lighting, crowd, crime, weather, reports)…</Text>}
      <Err>{err}</Err>

      {data && (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 92, height: 92, borderRadius: 46, borderWidth: 7, borderColor: s.color, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 30, fontWeight: '800', color: s.color }}>{data.point.score}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: s.color }}>{s.label}</Text>
              <Text style={{ color: C.sub, marginTop: 4, fontSize: 13 }}>{data.hourLabel}{data.simulatedTime ? ' (simulated)' : ''} · {data.dark === 1 ? 'Dark' : data.dark === 0.5 ? 'Twilight' : 'Daylight'}{data.weather ? ` · ${data.weather.condition}, ${Math.round(data.weather.tempC)}°C` : ''}</Text>
            </View>
          </View>
          <Text style={{ color: C.text, marginTop: 14, lineHeight: 20 }}>
            {data.point.why.length ? 'Risk factors: ' + data.point.why.map((w) => w.text).join(', ') + '.' : 'No major risk factors predicted here.'}
          </Text>
          <Text style={{ color: C.sub, marginTop: 8, fontSize: 12 }}>Lighting {data.point.factors.lit >= 0.6 ? 'good' : data.point.factors.lit >= 0.35 ? 'average' : 'poor'}{data.point.factors.litKnown ? '' : ' (estimated)'} · crowd {data.point.factors.crowd >= 0.5 ? 'good' : 'low'} · reports nearby {data.point.factors.reports} · crime layer: {data.crime}</Text>
        </Card>
      )}

      <Card>
        <Label>NEAREST SAFE PLACES</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{FILTERS.map(([k, l]) => <Chip key={k} label={l} selected={filter === k} onPress={() => setFilter(k)} />)}</View>
        {!busy && !list.length && <Text style={{ color: C.sub, marginTop: 12 }}>{zones.length ? 'None of this type within 2 km.' : 'No places found yet. Check your internet and pull to refresh below.'}</Text>}
        {list.slice(0, 25).map((z) => (
          <Pressable key={z.id} onPress={() => open(z)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.line, marginTop: 8 }}>
            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: TYPE_COLOR[z.t], alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{z.t}</Text></View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={{ color: C.text, fontWeight: '600' }}>{z.n || TYPE_LABEL[z.t]}</Text>
              <Text style={{ color: C.sub, fontSize: 12 }}>{TYPE_LABEL[z.t]}{z.h24 ? ' · open 24 h' : ''}{z.phone ? ' · ' + z.phone : ''}</Text>
            </View>
            <Text style={{ color: C.primary, fontWeight: '600' }}>{fmtDist(z.dist)}</Text>
          </Pressable>
        ))}
        <Btn title="Refresh" kind="ghost" onPress={load} disabled={busy} />
      </Card>

      <Card>
        <Label>REPORT AN UNSAFE SPOT HERE</Label>
        <Text style={{ color: C.sub, fontSize: 13 }}>Your report helps other women: routes through this spot will score lower.</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{REPORTS.map(([k, l]) => <Chip key={k} label={l} selected={rtype === k} onPress={() => setRtype(k)} />)}</View>
        <TextInput value={note} onChangeText={setNote} placeholder="Optional note" placeholderTextColor="#9AA4B2" maxLength={200}
          style={{ borderWidth: 1.5, borderColor: C.line, borderRadius: 10, padding: 10, marginTop: 12, color: C.text }} />
        <Btn title="Report this spot" kind="outline" onPress={report} disabled={!pos} />
        {!!sent && <Text style={{ color: C.ok, marginTop: 10 }}>{sent}</Text>}
      </Card>
    </Page>
  );
}
