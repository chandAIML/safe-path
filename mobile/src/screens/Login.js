import React, { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { Page, H1, Sub, Err, Field, Btn, Chip, Link, Label, Card } from '../ui';
import { C } from '../theme';
import { api, getBase, setBase } from '../api';

const DAYS = [1, 7, 30];

export default function Login({ notice, onSignedIn, onRegister }) {
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [days, setDays] = useState(7);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [editSrv, setEditSrv] = useState(false);
  const [srv, setSrv] = useState(getBase());

  async function submit() {
    const ok = /^\S+@\S+\.\S+$/.test(id.trim()) || /^[+]?\d[\d\s-]{8,13}$/.test(id.trim());
    if (!ok) return setErr('Enter a valid phone number or email.');
    if (pw.length < 6) return setErr('Password needs at least 6 characters.');
    setErr(''); setBusy(true);
    try { onSignedIn(await api('POST', '/auth/login', { id: id.trim(), password: pw, days })); }
    catch (e) { setErr(e.message); setBusy(false); }
  }

  return (
    <Page>
      <View style={{ marginTop: 40 }}>
        <Text style={{ color: C.primary, fontWeight: '800', fontSize: 15, letterSpacing: 1 }}>SAFEPATH</Text>
        <H1 style={{ marginTop: 8 }}>Welcome back</H1>
        <Sub>{notice || 'Sign in to keep your contacts and routes in sync.'}</Sub>
      </View>
      <Field label="Phone number or email" value={id} onChangeText={setId} autoCapitalize="none" keyboardType="email-address" placeholder="98765 43210 or you@mail.com" />
      <Field label="Password" value={pw} onChangeText={setPw} secureTextEntry placeholder="At least 6 characters" />
      <View style={{ marginTop: 16 }}>
        <Label>Keep me signed in for</Label>
        <View style={{ flexDirection: 'row' }}>
          {DAYS.map((d) => <Chip key={d} label={d === 1 ? '1 day' : d + ' days'} selected={days === d} onPress={() => setDays(d)} />)}
        </View>
      </View>
      <Err>{err}</Err>
      <Btn title={busy ? 'Signing in…' : 'Sign in'} onPress={submit} disabled={busy} />
      <View style={{ alignItems: 'center', marginTop: 20 }}>
        <Text style={{ color: C.sub }}>New here?</Text>
        <View style={{ marginTop: 6 }}><Link title="Create an account" onPress={onRegister} /></View>
      </View>

      <Card style={{ marginTop: 36 }}>
        <Label>Server</Label>
        {editSrv ? (
          <>
            <TextInput value={srv} onChangeText={setSrv} autoCapitalize="none" autoCorrect={false}
              style={{ borderWidth: 1.5, borderColor: C.line, borderRadius: 10, padding: 10, color: C.text }} placeholder="http://192.168.1.5:5050" />
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 10 }}>
              <Link title="Save" onPress={async () => { await setBase(srv.trim().replace(/\/$/, '')); setEditSrv(false); }} />
              <Link title="Use automatic" onPress={async () => { await setBase(null); setSrv(getBase()); setEditSrv(false); }} />
            </View>
          </>
        ) : (
          <>
            <Text style={{ color: C.text }}>{getBase()}</Text>
            <View style={{ marginTop: 8, alignItems: 'flex-start' }}><Link title="Change" onPress={() => { setSrv(getBase()); setEditSrv(true); }} /></View>
          </>
        )}
      </Card>
    </Page>
  );
}
