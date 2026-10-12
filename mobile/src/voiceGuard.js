// Voice & scream guard (works in plain Expo Go).
//  - The phone records 5-second audio chunks and measures loudness (screaming) on the phone itself.
//  - If the server has an AI key (GROQ_API_KEY), chunks with sound are sent to Whisper speech-to-text; the server looks for
//    distress words in English / Hindi / Telugu ("help", "bachao", "stop", "leave me alone"...). Without a key, only loudness is used.
//  - Decision: strong word -> SOS countdown.  "stop"-type word + loud, or two loud chunks within 25 s -> SOS countdown.
import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioMod } from './native';
import { api, upload } from './api';

export const voiceGuardSupported = !!AudioMod;
export const VOICE_LANGS = [{ label: 'Auto', code: '' }, { label: 'English', code: 'en' }, { label: 'తెలుగు', code: 'te' }, { label: 'हिन्दी', code: 'hi' }];
export const TUNING = { chunkMs: 5000, sampleMs: 150, loudDb: -12, soundDb: -45, loudSamples: 4, cooldown: 20000 };   // tweak here to change sensitivity
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// two loud chunks within 25 s = sustained screaming (pure function, unit-tested)
export function screamDetected(loudTimes, now) { return loudTimes.filter((t) => now - t < 25000).length >= 2; }

export function useVoiceGuard({ lang, onDistress, autoStart }) {
  const recorder = AudioMod ? AudioMod.useAudioRecorder({ ...AudioMod.RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true }) : null;
  const [on, setOn] = useState(false), [heard, setHeard] = useState(''), [msg, setMsg] = useState(''), [cloud, setCloud] = useState(false);
  const active = useRef(false), cloudOn = useRef(false), loudTimes = useRef([]), last = useRef(0);
  const trig = useRef(onDistress), langRef = useRef(lang);
  trig.current = onDistress; langRef.current = lang;

  const fire = useCallback((reason, text) => {
    if (Date.now() - last.current < TUNING.cooldown) return;
    last.current = Date.now(); setMsg(text); trig.current(reason);
  }, []);

  const sendChunk = useCallback(async (uri, loud) => {
    try {
      const fd = new FormData();
      fd.append('audio', { uri, name: 'chunk.m4a', type: 'audio/m4a' }); fd.append('lang', langRef.current || ''); fd.append('loud', loud ? '1' : '0');
      const r = await upload('/voice/check', fd, 25000);
      if (r.text) setHeard(r.text);
      if (r.level === 'sos') fire('voice', `Heard “${r.word}”. Starting SOS…`);
      else if (r.level === 'warn') setMsg(`Heard “${r.word}”. If you are in danger, say “help”.`);
    } catch (e) {
      if (e.status === 503) { cloudOn.current = false; setCloud(false); setMsg('Cloud speech is off on the server. Loud-scream detection still works.'); }
    }
  }, [fire]);

  const loop = useCallback(async () => {
    let fails = 0;
    while (active.current) {
      let loud = 0, sound = false, uri = null;
      try {
        await recorder.prepareToRecordAsync(); recorder.record();
        const t0 = Date.now();
        while (active.current && Date.now() - t0 < TUNING.chunkMs) {
          await sleep(TUNING.sampleMs);
          const m = recorder.getStatus().metering;
          if (typeof m === 'number') { if (m >= TUNING.loudDb) loud++; if (m >= TUNING.soundDb) sound = true; }
        }
        await recorder.stop(); uri = recorder.uri; fails = 0;
      } catch (e) {
        fails++; setMsg('Microphone problem: ' + e.message);
        if (fails >= 3) { active.current = false; setOn(false); break; }
        await sleep(800); continue;
      }
      const isLoud = loud >= TUNING.loudSamples, now = Date.now();
      if (isLoud) { loudTimes.current = loudTimes.current.filter((t) => now - t < 25000).concat(now); setMsg('Loud sound detected.'); }
      if (isLoud && screamDetected(loudTimes.current, now)) fire('scream', 'Sustained loud scream heard. Starting SOS…');
      else if (cloudOn.current && sound && uri) sendChunk(uri, isLoud);          // not awaited: recording continues
    }
  }, [recorder, fire, sendChunk]);

  const toggle = useCallback(async () => {
    if (!AudioMod) return setMsg('Audio module is not available on this phone.');
    if (active.current) { active.current = false; setOn(false); setMsg(''); try { await recorder.stop(); } catch (e) { /* idle */ } return; }
    const p = await AudioMod.requestRecordingPermissionsAsync();
    if (!p.granted) return setMsg('Allow the microphone to use the voice guard.');
    await AudioMod.setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    try { const s = await api('GET', '/voice/status'); cloudOn.current = !!s.stt; setCloud(!!s.stt); } catch (e) { cloudOn.current = false; setCloud(false); }
    active.current = true; setOn(true); setHeard(''); setMsg(''); loudTimes.current = []; loop();
  }, [loop, recorder]);

  useEffect(() => { if (autoStart) toggle(); return () => { active.current = false; }; }, []);   // eslint-disable-line
  return { on, heard, msg, cloud, toggle };
}

// Mounted only while the user wants the guard ON; reports its state upward. Unmounting stops the microphone.
export function VoiceHost({ lang, onDistress, onState }) {
  const g = useVoiceGuard({ lang, onDistress, autoStart: true });
  useEffect(() => { onState({ on: g.on, heard: g.heard, msg: g.msg, cloud: g.cloud }); }, [g.on, g.heard, g.msg, g.cloud]);   // eslint-disable-line
  useEffect(() => () => onState({ on: false, heard: '', msg: '', cloud: false }), []);   // eslint-disable-line
  return null;
}
