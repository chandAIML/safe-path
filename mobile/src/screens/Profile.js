// Edit profile any time: name, email, mobile number (needs password), change password, delete account.
import React, { useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { Page, H1, Sub, Err, Field, Btn, Link, Card, Label } from '../ui';
import { C } from '../theme';
import { api, getSession, setSessionUser, saveSession } from '../api';
import { ph } from '../util';

export default function Profile({ onBack, onDeleted }) {
  const u = getSession().user;
  const [name, setName] = useState(u.name), [email, setEmail] = useState(u.email || ''), [phone, setPhone] = useState(u.phone), [cur, setCur] = useState('');
  const [msg, setMsg] = useState(''), [err, setErr] = useState('');
  const [oldPw, setOldPw] = useState(''), [newPw, setNewPw] = useState(''), [pwMsg, setPwMsg] = useState('');
  const [delPw, setDelPw] = useState('');

  async function save() {
    setErr(''); setMsg('');
    const p = ph(phone); if (!p) return setErr('Enter a valid 10-digit mobile number.');
    try {
      const body = { name, email }; if (p !== u.phone) { body.phone = p; body.currentPassword = cur; }
      const r = await api('PUT', '/auth/me', body); await setSessionUser(r.user); setMsg('Profile saved.'); setCur('');
    } catch (e) { setErr(e.message); }
  }
  async function changePw() {
    setPwMsg('');
    try { const r = await api('POST', '/auth/password', { current: oldPw, next: newPw, days: 7 }); await saveSession(r); setOldPw(''); setNewPw(''); setPwMsg('Password changed. Other phones were signed out.'); }
    catch (e) { setPwMsg(e.message); }
  }
  function del() {
    Alert.alert('Delete your account?', 'This removes your profile, contacts, SOS history and evidence. It cannot be undone.', [{ text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { try { await api('DELETE', '/auth/me', { password: delPw }); onDeleted(); } catch (e) { setErr(e.message); } } }]);
  }
  return (
    <Page>
      <View style={{ marginTop: 8 }}><Link title="‹ Back" onPress={onBack} /></View>
      <H1 style={{ marginTop: 18 }}>Your profile</H1>
      <Sub>You can edit these any time.</Sub>
      <Card>
        <Field label="Full name" value={name} onChangeText={setName} style={{ marginTop: 0 }} />
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <Field label="Mobile number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        {ph(phone) !== u.phone && <Field label="Current password (needed to change the number)" value={cur} onChangeText={setCur} secureTextEntry />}
        <Err>{err}</Err>{!!msg && <Text style={{ color: C.ok, marginTop: 10 }}>{msg}</Text>}
        <Btn title="Save changes" onPress={save} />
      </Card>
      <Card>
        <Label>CHANGE PASSWORD</Label>
        <Field label="Current password" value={oldPw} onChangeText={setOldPw} secureTextEntry style={{ marginTop: 0 }} />
        <Field label="New password" value={newPw} onChangeText={setNewPw} secureTextEntry placeholder="At least 6 characters" />
        {!!pwMsg && <Text style={{ color: /changed/.test(pwMsg) ? C.ok : C.danger, marginTop: 10 }}>{pwMsg}</Text>}
        <Btn title="Change password" kind="outline" onPress={changePw} />
      </Card>
      <Card style={{ borderColor: C.danger }}>
        <Label>DELETE ACCOUNT</Label>
        <Field label="Password" value={delPw} onChangeText={setDelPw} secureTextEntry style={{ marginTop: 0 }} />
        <Btn title="Delete my account" kind="danger" onPress={del} disabled={!delPw} />
      </Card>
    </Page>
  );
}
