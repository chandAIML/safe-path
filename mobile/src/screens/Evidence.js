// SOS history + recorded evidence (video/audio, GPS, timestamps) stored on the server.
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { Page, H1, Sub, Err, Card, Link, Label } from '../ui';
import { C } from '../theme';
import { api } from '../api';
import { fmtSize, fmtTime } from '../util';

export default function Evidence({ onBack }) {
  const [items, setItems] = useState([]), [events, setEvents] = useState([]), [err, setErr] = useState(''), [busy, setBusy] = useState(true);
  async function load() {
    setBusy(true); setErr('');
    try { setItems((await api('GET', '/evidence')).items); setEvents((await api('GET', '/sos')).events); } catch (e) { setErr(e.message); }
    setBusy(false);
  }
  useEffect(() => { load(); }, []);
  const del = (id) => Alert.alert('Delete this evidence?', 'It will be removed from the server.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { try { await api('DELETE', '/evidence/' + id); load(); } catch (e) { setErr(e.message); } } }]);
  return (
    <Page>
      <View style={{ marginTop: 8 }}><Link title="‹ Back" onPress={onBack} /></View>
      <H1 style={{ marginTop: 18 }}>Evidence & history</H1>
      <Sub>When SOS starts, the front camera and microphone record automatically. Clips, GPS points and timestamps are saved on the server.</Sub>
      <Err>{err}</Err>
      <Card>
        <Label>RECORDED EVIDENCE</Label>
        {busy && <Text style={{ color: C.sub }}>Loading…</Text>}
        {!busy && !items.length && <Text style={{ color: C.sub }}>No evidence yet. It is recorded only during an SOS.</Text>}
        {items.map((e) => (
          <View key={e.id} style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.line, marginTop: 8 }}>
            <Text style={{ color: C.text, fontWeight: '600' }}>{fmtTime(e.startedAt)} · {Math.max(1, Math.round((e.endedAt - e.startedAt) / 1000))} s · {fmtSize(e.size)}</Text>
            <Text style={{ color: C.sub, fontSize: 12, marginTop: 2 }}>{e.points} GPS points{e.first ? ` · started at ${e.first.lat.toFixed(4)}, ${e.first.lng.toFixed(4)}` : ''}</Text>
            <Pressable onPress={() => del(e.id)} style={{ marginTop: 6 }}><Text style={{ color: C.danger, fontSize: 13, fontWeight: '600' }}>Delete</Text></Pressable>
          </View>
        ))}
        <Text style={{ color: C.sub, fontSize: 12, marginTop: 12 }}>Files are in backend/data/evidence on the server computer.</Text>
      </Card>
      <Card>
        <Label>SOS HISTORY</Label>
        {!busy && !events.length && <Text style={{ color: C.sub }}>No SOS events.</Text>}
        {events.map((e) => (
          <View key={e.id} style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.line, marginTop: 6 }}>
            <Text style={{ color: C.text, fontWeight: '600' }}>{fmtTime(e.at)}{e.reason && e.reason !== 'manual' ? ' · ' + e.reason : ''}</Text>
            <Text style={{ color: C.sub, fontSize: 12 }}>{e.lat != null ? `${e.lat.toFixed(4)}, ${e.lng.toFixed(4)}` : 'location unavailable'} · {e.actions.length} actions</Text>
          </View>
        ))}
      </Card>
    </Page>
  );
}
