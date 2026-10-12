// AI Safety Chatbot: describe the situation, get analysis + suggestions. Offers the SOS button when it sounds urgent.
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, Linking, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Link, Btn, Chip } from '../ui';
import { C } from '../theme';
import { api } from '../api';

const QUICK = ['Someone is following me', 'Cab driver is taking a wrong route', 'I am walking alone at night', 'A man is harassing me'];
const HELLO = { role: 'assistant', content: 'Hi, I am SafePath. Tell me what is happening: where you are, who is near you, and whether you feel in danger right now. I will suggest what to do. You can write in English, తెలుగు or हिन्दी.' };

export default function Chat({ onBack, sos, demoHour }) {
  const [msgs, setMsgs] = useState([HELLO]), [text, setText] = useState(''), [busy, setBusy] = useState(false);
  const pos = useRef(null), scroll = useRef(null);
  useEffect(() => { Location.getLastKnownPositionAsync().then((p) => { if (p) pos.current = { lat: p.coords.latitude, lng: p.coords.longitude }; }).catch(() => {}); }, []);

  async function send(t) {
    const content = (t || text).trim(); if (!content || busy) return;
    const next = [...msgs, { role: 'user', content }]; setMsgs(next); setText(''); setBusy(true);
    try {
      const history = next.filter((m) => m !== HELLO).map(({ role, content }) => ({ role, content }));
      const ctx = { ...(pos.current || {}) }; if (demoHour != null) ctx.hour = demoHour;
      const r = await api('POST', '/chat', { messages: history, context: ctx }, 30000);
      setMsgs([...next, { role: 'assistant', content: r.reply, sos: r.sos, source: r.source }]);
    } catch (e) { setMsgs([...next, { role: 'assistant', content: 'I could not reach the server (' + e.message + '). If you are in danger call 112 now.', sos: false, source: 'error' }]); }
    setBusy(false); setTimeout(() => scroll.current && scroll.current.scrollToEnd({ animated: true }), 100);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ padding: 20, paddingBottom: 8 }}><Link title="‹ Back" onPress={onBack} /><Text style={{ fontSize: 26, fontWeight: '700', color: C.text, marginTop: 14 }}>AI safety chat</Text></View>
        <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingTop: 4 }} keyboardShouldPersistTaps="handled" onContentSizeChange={() => scroll.current && scroll.current.scrollToEnd({ animated: true })}>
          {msgs.map((m, i) => (
            <View key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%', marginTop: 10 }}>
              <View style={{ backgroundColor: m.role === 'user' ? C.primary : C.card, borderRadius: 14, padding: 12, borderWidth: m.role === 'user' ? 0 : 1, borderColor: C.line }}>
                <Text style={{ color: m.role === 'user' ? '#fff' : C.text, lineHeight: 21 }}>{m.content}</Text>
              </View>
              {m.role === 'assistant' && !!m.source && m.source !== 'error' && <Text style={{ color: C.sub, fontSize: 11, marginTop: 3 }}>{m.source === 'ai' ? 'AI assistant' : 'Offline safety advisor'}</Text>}
              {!!m.sos && (
                <View style={{ backgroundColor: C.dangerSoft, borderRadius: 12, padding: 12, marginTop: 8 }}>
                  <Text style={{ color: C.danger, fontWeight: '700' }}>This sounds urgent</Text>
                  <Btn title="Start SOS now" kind="danger" onPress={() => sos.start('manual')} />
                  <Btn title="Call 112" kind="outline" onPress={() => Linking.openURL('tel:112')} />
                </View>
              )}
            </View>
          ))}
          {busy && <Text style={{ color: C.sub, marginTop: 12 }}>Thinking…</Text>}
          {msgs.length === 1 && <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 14 }}>{QUICK.map((q) => <Chip key={q} label={q} onPress={() => send(q)} />)}</View>}
        </ScrollView>
        <View style={{ flexDirection: 'row', padding: 12, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.line, alignItems: 'center' }}>
          <TextInput value={text} onChangeText={setText} placeholder="Describe the situation…" placeholderTextColor="#9AA4B2" multiline
            style={{ flex: 1, maxHeight: 110, borderWidth: 1.5, borderColor: C.line, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, color: C.text }} />
          <Pressable onPress={() => send()} disabled={busy} style={{ marginLeft: 10, backgroundColor: C.primary, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 12, opacity: busy ? 0.5 : 1 }}><Text style={{ color: '#fff', fontWeight: '700' }}>Send</Text></Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
