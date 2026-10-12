// Automatic evidence: while an SOS is active the FRONT camera records video + audio in 20-second clips, GPS points and timestamps
// are collected, and every clip is uploaded to the server (it also stays on the phone if the upload fails).
import React, { useEffect, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import * as Location from 'expo-location';
import { CameraMod } from './native';
import { upload } from './api';
import { C } from './theme';

export async function askEvidencePermissions() {              // asked once on the home screen, so no popup appears during an emergency
  if (!CameraMod) return;
  try { await CameraMod.requestCameraPermissionsAsync(); await CameraMod.requestMicrophonePermissionsAsync(); } catch (e) { /* ignore */ }
}

export default function EvidenceRecorder(props) { return CameraMod ? <Recorder {...props} /> : null; }

function Recorder({ active, sosId }) {
  const { CameraView, useCameraPermissions, useMicrophonePermissions } = CameraMod;
  const [cam] = useCameraPermissions(), [mic] = useMicrophonePermissions();
  const ref = useRef(null), track = useRef([]);
  const [ready, setReady] = useState(false), [secs, setSecs] = useState(0), [status, setStatus] = useState(''), [saved, setSaved] = useState(0), [warn, setWarn] = useState('');
  const ok = !!(cam && cam.granted && mic && mic.granted);

  useEffect(() => {                                            // GPS track with timestamps
    if (!active) return;
    let sub = null, dead = false;
    Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, timeInterval: 4000, distanceInterval: 0 },
      (l) => track.current.push({ lat: l.coords.latitude, lng: l.coords.longitude, t: Date.now() })).then((s) => { if (dead) s.remove(); else sub = s; }).catch(() => {});
    const clock = setInterval(() => setSecs((n) => n + 1), 1000);
    return () => { dead = true; clearInterval(clock); if (sub) sub.remove(); };
  }, [active]);

  useEffect(() => {                                            // record clip after clip until the SOS is closed
    if (!active || !ready || !ok) return;
    let stop = false;
    (async () => {
      while (!stop) {
        const startedAt = Date.now(); setStatus('Recording evidence…');
        let res = null;
        try { res = await ref.current.recordAsync({ maxDuration: 20 }); } catch (e) { setStatus('Recording stopped: ' + e.message); break; }
        const endedAt = Date.now();
        if (res && res.uri) {
          const fd = new FormData();
          fd.append('video', { uri: res.uri, name: `evidence-${startedAt}.mp4`, type: 'video/mp4' });
          fd.append('meta', JSON.stringify({ sosId: sosId || '', startedAt, endedAt, track: track.current.filter((p) => p.t >= startedAt - 5000 && p.t <= endedAt) }));
          try { await upload('/evidence', fd); setSaved((n) => n + 1); setWarn(''); setStatus('Evidence saved on the server'); }
          catch (e) { setWarn('Upload failed (' + e.message + '). The clip is kept on this phone.'); }
        }
      }
    })();
    return () => { stop = true; try { ref.current && ref.current.stopRecording(); } catch (e) { /* ignore */ } };
  }, [active, ready, ok, sosId]);

  if (!ok) return <Text style={{ color: C.warn, fontSize: 13, marginTop: 8 }}>Camera / microphone permission is off, so evidence is not being recorded. Allow it in phone Settings.</Text>;
  const mm = String(Math.floor(secs / 60)).padStart(2, '0') + ':' + String(secs % 60).padStart(2, '0');
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
      <View style={{ width: 84, height: 112, borderRadius: 10, overflow: 'hidden', backgroundColor: '#000' }}>
        <CameraView ref={ref} style={{ flex: 1 }} facing="front" mode="video" mute={false} onCameraReady={() => setReady(true)} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ color: C.danger, fontWeight: '800' }}>● REC {mm}</Text>
        <Text style={{ color: C.text, marginTop: 4, fontSize: 13 }}>Front camera + audio + GPS + timestamps</Text>
        <Text style={{ color: C.sub, marginTop: 2, fontSize: 12 }}>{status}{saved ? ` · ${saved} clip${saved > 1 ? 's' : ''} saved` : ''}</Text>
        {!!warn && <Text style={{ color: C.warn, marginTop: 2, fontSize: 12 }}>{warn}</Text>}
      </View>
    </View>
  );
}
