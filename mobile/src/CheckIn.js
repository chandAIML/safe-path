// Check-in timer: "I'll reach in 30 min". Confirm arrival, or after a 30 s "Are you safe?" prompt the SOS starts.
// The server also watches the timer, so the SOS is sent even if this phone dies or the app is closed.
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Modal, Vibration } from 'react-native';
import { Card, Btn, Chip, Label } from './ui';
import { C } from './theme';
import { api } from './api';
import { currentCoords } from './sos';

const OPTS = [{ l: '10 sec (demo)', m: 0.17 }, { l: '15 min', m: 15 }, { l: '30 min', m: 30 }, { l: '1 hour', m: 60 }];
const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };

export default function CheckIn({ onMissed, onToast }) {
  const [opt, setOpt] = useState(2);
  const [end, setEnd] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [prompt, setPrompt] = useState(0);        // seconds left to answer; 0 = hidden
  const pTimer = useRef(null);

  useEffect(() => { api('GET', '/checkin').then((r) => setEnd(r.checkin ? r.checkin.end : null)).catch(() => {}); return () => clearInterval(pTimer.current); }, []);
  useEffect(() => { if (!end) return; const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, [end]);
  useEffect(() => { if (end && now >= end && !pTimer.current) startPrompt(); }, [now, end]);

  function startPrompt() {
    let n = 30; setPrompt(n); Vibration.vibrate([0, 300, 100, 300]);
    pTimer.current = setInterval(() => {
      n -= 1;
      if (n <= 0) { clearInterval(pTimer.current); pTimer.current = null; setPrompt(0); setEnd(null); onMissed(); }
      else setPrompt(n);
    }, 1000);
  }
  function stopPrompt() { clearInterval(pTimer.current); pTimer.current = null; setPrompt(0); }

  async function start() {
    const m = OPTS[opt].m;
    setEnd(Date.now() + m * 60000);
    const loc = await currentCoords(true);
    api('POST', '/checkin', { minutes: m, ...loc }).catch(() => onToast('Server not reachable: this check-in only runs on this phone.'));
  }
  function extend() { setEnd(end + 10 * 60000); api('POST', '/checkin/extend', { minutes: 10 }).catch(() => {}); }
  function arrived() { stopPrompt(); setEnd(null); api('POST', '/checkin/confirm').catch(() => {}); onToast('You arrived safely. Contacts notified.'); }

  return (
    <Card>
      <Label>CHECK-IN TIMER</Label>
      {!end ? (
        <>
          <Text style={{ color: C.sub, marginBottom: 4 }}>Tell us when you’ll reach. If you don’t confirm, we alert your contacts.</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {OPTS.map((o, i) => <Chip key={o.l} label={o.l} selected={opt === i} onPress={() => setOpt(i)} />)}
          </View>
          <Btn title="Start check-in" onPress={start} />
        </>
      ) : (
        <>
          <Text style={{ fontSize: 52, fontWeight: '700', color: C.primary, textAlign: 'center', marginTop: 4 }}>{fmt(end - now)}</Text>
          <Text style={{ color: C.sub, textAlign: 'center' }}>Reach by {new Date(end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Confirm arrival or your contacts are alerted.</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Btn title="+10 min" kind="outline" onPress={extend} style={{ flex: 1 }} />
            <Btn title="I’ve arrived safely" onPress={arrived} style={{ flex: 2 }} />
          </View>
        </>
      )}
      <Modal visible={prompt > 0} animationType="fade" onRequestClose={() => {}}>
        <View style={{ flex: 1, backgroundColor: C.warn, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
          <Text style={{ color: '#FFE9CC', fontWeight: '800', letterSpacing: 2 }}>CHECK-IN TIME IS UP</Text>
          <Text style={{ color: '#fff', fontSize: 120, fontWeight: '800', lineHeight: 140 }}>{prompt}</Text>
          <Text style={{ color: '#FFF3E0', textAlign: 'center', fontSize: 16, marginBottom: 28 }}>Are you safe? If you don’t reply, the SOS countdown starts.</Text>
          <Btn title="I’m safe" kind="outline" onPress={arrived} style={{ alignSelf: 'stretch', borderColor: '#fff' }} />
        </View>
      </Modal>
    </Card>
  );
}
