import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, Easing, Switch } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { Page, H1, Sub, Card, Btn, Link, Label, Chip } from '../ui';
import { C } from '../theme';
import CheckIn from '../CheckIn';
import { getContacts, loadContacts, getSession } from '../api';
import { VOICE_LANGS, voiceGuardSupported } from '../voiceGuard';
import { shakeSupported } from '../shake';
import { askEvidencePermissions } from '../evidence';
import { scoreInfo } from '../util';

// Big red button. Must be HELD for 2 seconds so a pocket touch can't send an SOS.
function HoldSOS({ onTrigger }) {
  const p = useRef(new Animated.Value(0)).current;
  const anim = useRef(null);
  const begin = () => {
    anim.current = Animated.timing(p, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: false });
    anim.current.start(({ finished }) => { if (finished) { p.setValue(0); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); onTrigger(); } });
  };
  const end = () => { if (anim.current) anim.current.stop(); p.setValue(0); };
  return (
    <View style={{ alignItems: 'center', marginTop: 8 }}>
      <Pressable onPressIn={begin} onPressOut={end}
        style={{ width: 190, height: 190, borderRadius: 95, backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center', elevation: 8,
          shadowColor: C.danger, shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, borderWidth: 6, borderColor: C.dangerSoft }}>
        <Text style={{ color: '#fff', fontSize: 48, fontWeight: '800', letterSpacing: 2 }}>SOS</Text>
        <Text style={{ color: '#FFE4E1', fontSize: 13, marginTop: 2 }}>Hold for 2 seconds</Text>
      </Pressable>
      <View style={{ width: 190, height: 6, borderRadius: 3, backgroundColor: C.line, marginTop: 16, overflow: 'hidden' }}>
        <Animated.View style={{ height: 6, backgroundColor: C.danger, width: p.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
      </View>
    </View>
  );
}

const Row = ({ title, text, value, onChange, disabled }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.line }}>
    <View style={{ flex: 1, paddingRight: 12 }}>
      <Text style={{ color: C.text, fontWeight: '700', fontSize: 14 }}>{title}</Text>
      <Text style={{ color: C.sub, fontSize: 12, marginTop: 2, lineHeight: 17 }}>{text}</Text>
    </View>
    <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: C.primary }} />
  </View>
);

export default function Home({ go, onSignOut, sos, g }) {
  const user = getSession().user;
  const [contacts, setContacts] = useState(getContacts());
  const [toast, setToast] = useState('');
  const tt = useRef(null);
  const say = (t) => { setToast(t); clearTimeout(tt.current); tt.current = setTimeout(() => setToast(''), 4000); };

  useEffect(() => {
    loadContacts().then(setContacts).catch(() => {});
    Location.requestForegroundPermissionsAsync().catch(() => {}).then(() => askEvidencePermissions());     // asked once here, never during an emergency
    return () => clearTimeout(tt.current);
  }, []);

  const v = g.voiceState, w = g.watch;
  return (
    <Page>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <View style={{ flex: 1 }}><H1>Hi, {user.name.split(' ')[0]}</H1></View>
        <Link title="Sign out" onPress={onSignOut} />
      </View>
      <Sub>{contacts.length ? `${contacts.length} emergency contact${contacts.length > 1 ? 's' : ''} ready` : 'No emergency contacts yet'}</Sub>

      <Card style={{ paddingVertical: 24 }}><HoldSOS onTrigger={() => sos.start('manual')} /></Card>

      <Card style={{ paddingBottom: 6 }}>
        <Label>AUTOMATIC PROTECTION</Label>
        <Row title="Voice & scream guard" value={g.voiceWanted} onChange={g.setVoiceWanted} disabled={!voiceGuardSupported}
          text="Listens for “help”, “stop”, “leave me alone” (English / తెలుగు / हिन्दी) and loud screams. Starts the SOS countdown." />
        {g.voiceWanted && (
          <View style={{ paddingBottom: 8 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{VOICE_LANGS.map((l) => <Chip key={l.label} label={l.label} selected={g.voiceLang === l.code} onPress={() => g.setVoiceLang(l.code)} />)}</View>
            {v.on && <Text style={{ color: C.ok, marginTop: 10, fontWeight: '600' }}>● Listening…</Text>}
            {v.on && <Text style={{ color: C.sub, fontSize: 12, marginTop: 2 }}>{v.cloud ? 'Word detection ON (cloud speech).' : 'Scream detection only. Add GROQ_API_KEY on the server to detect words.'}</Text>}
            {!!v.heard && <Text style={{ color: C.sub, fontSize: 12, marginTop: 4 }}>Heard: {v.heard}</Text>}
            {!!v.msg && <Text style={{ color: C.warn, fontSize: 12, marginTop: 4 }}>{v.msg}</Text>}
          </View>
        )}
        <Row title="Shake to SOS" value={g.shakeOn} onChange={g.setShakeOn} disabled={!shakeSupported} text="Shake the phone hard 4 times to start the SOS countdown." />
        <Row title="Predictive risk alerts" value={w.on} onChange={w.toggle} text="Warns you before you walk into a risky area (dark, isolated, crime, reports) and shows the nearest help." />
        {w.on && !!w.last && <Text style={{ color: scoreInfo(w.last.point.score).color, fontSize: 13, fontWeight: '600', paddingBottom: 8 }}>Here: {w.last.point.score}/100 · {scoreInfo(w.last.point.score).label}</Text>}
        {!!w.msg && <Text style={{ color: C.danger, fontSize: 12, paddingBottom: 8 }}>{w.msg}</Text>}
        <Row title="Demo: pretend it is 11 PM" value={g.demo} onChange={g.setDemo} text="Shows the night-time risk prediction even during the day (for the demo)." />
      </Card>

      <CheckIn onMissed={() => sos.start('missed check-in')} onToast={say} />

      <Btn title="Plan a safe route" onPress={() => go('route')} />
      <Btn title="Area safety & nearby safe places" kind="outline" onPress={() => go('safety')} />
      <Btn title="AI safety chat" kind="outline" onPress={() => go('chat')} />
      <Btn title="Evidence & SOS history" kind="outline" onPress={() => go('evidence')} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Btn title="Profile" kind="ghost" onPress={() => go('profile')} style={{ flex: 1 }} />
        <Btn title="Contacts" kind="ghost" onPress={() => go('contacts')} style={{ flex: 1 }} />
      </View>

      {!!toast && <View style={{ backgroundColor: C.text, borderRadius: 10, padding: 12, marginTop: 16 }}><Text style={{ color: '#fff' }}>{toast}</Text></View>}
    </Page>
  );
}
