// SOS flow: hold button -> 5 second cancellable countdown -> server alerts contacts -> result screen.
// If the server can't be reached (no internet), the phone's own SMS app opens with the message ready, so the alert still goes out.
import React, { useState, useRef, useCallback } from 'react';
import { Modal, View, Text, Vibration, Linking, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import { SMS } from './native';
import EvidenceRecorder from './evidence';
import { api, getContacts, getSession } from './api';
import { Btn, Boundary } from './ui';
import { fmtPhone } from './util';
import { C } from './theme';

export async function currentCoords(fast = false) {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return {};
    let p = fast ? await Location.getLastKnownPositionAsync() : null;
    if (!p) p = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000)),
    ]);
    return { lat: p.coords.latitude, lng: p.coords.longitude };
  } catch (e) {
    try { const p = await Location.getLastKnownPositionAsync(); if (p) return { lat: p.coords.latitude, lng: p.coords.longitude }; } catch (e2) {}
    return {};
  }
}

export const sosText = (name, loc) =>
  `SOS! ${name} may be in danger. ` + (loc && loc.lat != null ? `Live location: https://maps.google.com/?q=${loc.lat},${loc.lng}` : 'Location unavailable.') + ' Please call now.';

// Real SMS from THIS phone's SIM (works without internet, needs mobile signal). Opens the SMS app; the user presses Send.
export async function smsFromPhone(loc) {
  const cs = getContacts();
  if (!cs.length) return 'No emergency contacts saved.';
  if (!SMS || !(await SMS.isAvailableAsync())) return 'This device cannot send SMS.';
  const s = getSession(), name = (s && s.user && s.user.name) || 'Someone';
  await SMS.sendSMSAsync(cs.map((c) => c.phone), sosText(name, loc));
  return '';
}

export function useSOS() {
  const [phase, setPhase] = useState(null);      // null | 'count' | 'sent'
  const [count, setCount] = useState(5);
  const [actions, setActions] = useState([]);
  const [messages, setMessages] = useState([]);
  const [simulated, setSimulated] = useState(false);
  const [loc, setLoc] = useState({});
  const [sosId, setSosId] = useState('');
  const reasonRef = useRef('manual');
  const [error, setError] = useState('');
  const timer = useRef(null);
  const busy = useRef(false);

  const send = useCallback(async () => {
    setPhase('sent'); Vibration.vibrate([0, 400, 200, 400, 200, 400]);
    const where = await currentCoords(); setLoc(where);
    try {
      const r = await api('POST', '/sos', { ...where, reason: reasonRef.current });
      setActions(r.actions); setMessages(r.messages || []); setSimulated(!!r.simulated); setSosId(r.id || '');
    } catch (e) {
      setError(e.message + '\n\nOpening your SMS app with the message. Press Send to alert your contacts.');
      smsFromPhone(where).catch(() => {});       // offline fallback
    }
  }, []);

  const start = useCallback((reason) => {
    if (busy.current) return;
    reasonRef.current = typeof reason === 'string' ? reason : 'manual';
    busy.current = true; setPhase('count'); setCount(5); setActions([]); setMessages([]); setError(''); Vibration.vibrate(300);
    let n = 5;
    timer.current = setInterval(() => {
      n -= 1;
      if (n <= 0) { clearInterval(timer.current); timer.current = null; send(); }
      else { setCount(n); Vibration.vibrate(100); }
    }, 1000);
  }, [send]);

  const cancel = useCallback(() => {
    clearInterval(timer.current); timer.current = null; busy.current = false; setPhase(null); Vibration.cancel();
  }, []);
  const done = useCallback(() => { busy.current = false; setPhase(null); setActions([]); setMessages([]); setError(''); Vibration.cancel(); }, []);
  return { phase, count, actions, messages, simulated, loc, sosId, error, start, cancel, done };
}

export function SOSModal({ sos }) {
  const { phase, count, actions, messages, simulated, loc, sosId, error, cancel, done } = sos;
  const [smsNote, setSmsNote] = useState('');
  return (
    <Modal visible={!!phase} animationType="fade" onRequestClose={() => {}}>
      {phase === 'count' ? (
        <View style={{ flex: 1, backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
          <Text style={{ color: '#FFD9D5', fontWeight: '800', letterSpacing: 2 }}>SENDING SOS IN</Text>
          <Text style={{ color: '#fff', fontSize: 150, fontWeight: '800', lineHeight: 170 }}>{count}</Text>
          <Text style={{ color: '#FFE4E1', textAlign: 'center', fontSize: 16, marginBottom: 28 }}>
            Your emergency contacts will get your live location.
          </Text>
          <Btn title="I’m safe, cancel" kind="outline" onPress={cancel} style={{ alignSelf: 'stretch', borderColor: '#fff' }} />
        </View>
      ) : (
        <View style={{ flex: 1, backgroundColor: C.bg, padding: 24, paddingTop: 60 }}>
          <Text style={{ color: C.danger, fontWeight: '800', letterSpacing: 2 }}>SOS SENT</Text>
          <Text style={{ fontSize: 26, fontWeight: '700', color: C.text, marginTop: 6 }}>Help is being alerted</Text>
          <ScrollView style={{ marginTop: 16 }}>
            {!actions.length && !error && <Text style={{ color: C.sub }}>Contacting your emergency contacts…</Text>}
            {actions.map((a, i) => (
              <View key={i} style={{ flexDirection: 'row', marginBottom: 10 }}>
                <Text style={{ color: a.ok ? C.ok : C.danger, fontWeight: '800', width: 22 }}>{a.ok ? '✓' : '!'}</Text>
                <Text style={{ color: C.text, flex: 1, fontSize: 15, lineHeight: 21 }}>{a.text}</Text>
              </View>
            ))}
            {!!error && <Text style={{ color: C.danger, fontSize: 15, lineHeight: 21 }}>{error}</Text>}

            {messages.length > 0 && (
              <View style={{ marginTop: 10 }}>
                <Text style={{ color: C.sub, fontWeight: '700', fontSize: 12, letterSpacing: 1 }}>MESSAGES SENT{simulated ? ' (SIMULATED)' : ''}</Text>
                {messages.map((m, i) => (
                  <View key={i} style={{ backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.line, padding: 12, marginTop: 8 }}>
                    <Text style={{ color: C.sub, fontSize: 12 }}>To {m.to} · {fmtPhone(m.phone)}</Text>
                    <Text style={{ color: C.text, marginTop: 4, lineHeight: 20 }}>{m.text}</Text>
                  </View>
                ))}
              </View>
            )}
            {!!smsNote && <Text style={{ color: C.warn, marginTop: 10 }}>{smsNote}</Text>}
            <Boundary fallback={<Text style={{ color: C.warn, marginTop: 8, fontSize: 13 }}>Camera is not available, evidence recording skipped.</Text>}><EvidenceRecorder active={phase === 'sent'} sosId={sosId} /></Boundary>
          </ScrollView>
          <Btn title="Send SMS from this phone (works offline)" kind="outline" onPress={async () => setSmsNote(await smsFromPhone(loc).catch((e) => e.message))} />
          <Btn title="Call 112 (police / emergency)" kind="danger" onPress={() => Linking.openURL('tel:112')} />
          <Btn title="I’m safe now" kind="ghost" onPress={() => { setSmsNote(''); done(); }} />
        </View>
      )}
    </Modal>
  );
}
