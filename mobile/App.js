import React, { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { C } from './src/theme';
import { Boundary } from './src/ui';
import { api, loadStored, saveSession, clearSession, loadContacts, setOnExpire } from './src/api';
import { useSOS, SOSModal } from './src/sos';
import { useShake } from './src/shake';
import { useRiskWatch } from './src/riskWatch';
import { VoiceHost } from './src/voiceGuard';
import Login from './src/screens/Login';
import Register from './src/screens/Register';
import Contacts from './src/screens/Contacts';
import Home from './src/screens/Home';
import RouteScreen from './src/screens/Route';
import Safety from './src/screens/Safety';
import Chat from './src/screens/Chat';
import Evidence from './src/screens/Evidence';
import Profile from './src/screens/Profile';

const EXPIRED = 'Your session has expired. Sign in again to continue.';
const BACK = { register: 'login', 'contacts-reg': 'register', contacts: 'home', route: 'home', safety: 'home', chat: 'home', evidence: 'home', profile: 'home' };

function Shell() {
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState('login');
  const [pending, setPending] = useState(null);
  const [notice, setNotice] = useState('');
  // protection settings live here, so they keep working while you move between screens
  const sos = useSOS();
  const [demo, setDemo] = useState(false), demoHour = demo ? 23 : null;
  const [shakeOn, setShakeOn] = useState(false);
  const [voiceWanted, setVoiceWanted] = useState(false), [voiceLang, setVoiceLang] = useState('');
  const [voiceState, setVoiceState] = useState({ on: false, heard: '', msg: '', cloud: false });
  const [riskBanner, setRiskBanner] = useState(null);
  const watch = useRiskWatch({ demoHour, onAlert: (text, level) => { setRiskBanner({ text, level }); setTimeout(() => setRiskBanner(null), 9000); } });
  useShake(shakeOn, () => sos.start('shake'));

  useEffect(() => {
    setOnExpire(() => { clearSession(); setNotice(EXPIRED); setScreen('login'); });
    (async () => {
      const s = await loadStored();                  // saved login (secure storage)
      if (s && s.exp > Date.now()) {
        let ok = true;
        try { await api('GET', '/auth/me'); } catch (e) { if (e.status !== 0) ok = false; }   // offline: still open (SOS needs the app)
        if (ok) setScreen('home');
      } else if (s) { await clearSession(); setNotice(EXPIRED); }
      setReady(true);
    })();
  }, []);

  useEffect(() => {                                  // Android back button
    const sub = BackHandler.addEventListener('hardwareBackPress', () => (BACK[screen] ? (setScreen(BACK[screen]), true) : false));
    return () => sub.remove();
  }, [screen]);

  async function signedIn(res) {                     // res = { token, exp, user } from the server
    await saveSession(res); setNotice('');
    await loadContacts().catch(() => {});
    setScreen('home'); setPending(null);             // clear the sign-up data only AFTER leaving the sign-up screen
  }
  async function signOut() {
    setVoiceWanted(false); setShakeOn(false); if (watch.on) watch.toggle();
    await api('POST', '/checkin/confirm').catch(() => {});
    await clearSession(); setNotice(''); setScreen('login');
  }

  if (!ready) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}><ActivityIndicator color={C.primary} /></View>;
  const g = { voiceWanted, setVoiceWanted, voiceLang, setVoiceLang, voiceState, shakeOn, setShakeOn, watch, demo, setDemo };

  return (
    <>
      {screen === 'login' && <Login notice={notice} onSignedIn={signedIn} onRegister={() => setScreen('register')} />}
      {screen === 'register' && <Register onBack={() => setScreen('login')} onNext={(d) => { setPending(d); setScreen('contacts-reg'); }} />}
      {screen === 'contacts-reg' && <Contacts mode="reg" pending={pending} onBack={() => setScreen('register')} onFinish={signedIn} />}
      {screen === 'contacts' && <Contacts mode="edit" onFinish={() => setScreen('home')} />}
      {screen === 'home' && <Home go={setScreen} onSignOut={signOut} sos={sos} g={g} />}
      {screen === 'route' && <RouteScreen onBack={() => setScreen('home')} demoHour={demoHour} />}
      {screen === 'safety' && <Safety onBack={() => setScreen('home')} demoHour={demoHour} />}
      {screen === 'chat' && <Chat onBack={() => setScreen('home')} sos={sos} demoHour={demoHour} />}
      {screen === 'evidence' && <Evidence onBack={() => setScreen('home')} />}
      {screen === 'profile' && <Profile onBack={() => setScreen('home')} onDeleted={async () => { await clearSession(); setScreen('login'); }} />}

      {voiceWanted && <Boundary fallback={null}><VoiceHost lang={voiceLang} onDistress={(r) => sos.start(r)} onState={setVoiceState} /></Boundary>}
      <SOSModal sos={sos} />
      {!!riskBanner && (
        <SafeAreaView pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
          <Pressable onPress={() => setRiskBanner(null)} style={{ margin: 12, padding: 14, borderRadius: 12, backgroundColor: riskBanner.level === 'high' ? C.danger : C.warn, elevation: 10 }}>
            <Text style={{ color: '#fff', fontWeight: '800' }}>⚠ Risk alert</Text>
            <Text style={{ color: '#fff', marginTop: 4, lineHeight: 20 }}>{riskBanner.text}</Text>
          </Pressable>
        </SafeAreaView>
      )}
    </>
  );
}

// If something unexpected fails, show the reason on screen instead of Expo Go's blank "Something went wrong".
export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Boundary fallback={(err, retry) => (
        <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, padding: 24 }}>
          <Text style={{ fontSize: 22, fontWeight: '700', color: C.danger }}>SafePath hit a problem</Text>
          <Text style={{ color: C.text, marginTop: 12 }}>{String(err && err.message)}</Text>
          <Pressable onPress={retry} style={{ marginTop: 24, backgroundColor: C.primary, borderRadius: 10, padding: 14, alignItems: 'center' }}><Text style={{ color: '#fff', fontWeight: '700' }}>Try again</Text></Pressable>
        </SafeAreaView>
      )}>
        <Shell />
      </Boundary>
    </SafeAreaProvider>
  );
}
