// One screen, two modes:  "reg" = step 2 of sign-up (saved together with the account)
//                         "edit" = manage contacts later (each change is saved to the server straight away)
import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Page, H1, Sub, Err, Field, Btn, Chip, Link, Card, Label } from '../ui';
import { C } from '../theme';
import { api, getContacts, setContacts, getSession } from '../api';
import { ph, RELATIONS } from '../util';

export default function Contacts({ mode, pending, onFinish, onBack }) {
  const edit = mode === 'edit';
  const [list, setList] = useState(edit ? getContacts() : []);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [rel, setRel] = useState('Mother');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const own = edit ? ((getSession() || { user: {} }).user.phone) : (pending && pending.phone);

  const saved = async (r) => { await setContacts(r.contacts); setList(r.contacts); };
  const fail = (e) => setErr(e.message);

  async function add() {
    const p = ph(phone);
    if (name.trim().length < 2) return setErr('Enter the contact’s name.');
    if (!p) return setErr('Enter a valid 10-digit mobile number.');
    if (p === own) return setErr('That’s your own number. Add someone else.');
    if (list.some((c) => c.phone === p)) return setErr('This number is already added.');
    if (list.length >= 5) return setErr('You can add up to 5 contacts.');
    setErr('');
    const c = { name: name.trim(), phone: p, rel };
    try {
      if (edit) await saved(await api('POST', '/contacts', c)); else setList([...list, c]);
      setName(''); setPhone('');
    } catch (e) { fail(e); }
  }
  async function makePrimary(i) {
    try {
      if (edit) await saved(await api('PUT', `/contacts/${list[i].id}/primary`));
      else { const l = [...list]; l.unshift(l.splice(i, 1)[0]); setList(l); }
    } catch (e) { fail(e); }
  }
  async function remove(i) {
    try {
      if (edit) await saved(await api('DELETE', `/contacts/${list[i].id}`));
      else setList(list.filter((_, k) => k !== i));
    } catch (e) { fail(e); }
  }
  async function finish() {
    if (edit) return onFinish();
    if (!list.length) return setErr('Add at least one emergency contact first.');
    setBusy(true); setErr('');
    try { onFinish(await api('POST', '/auth/register', { ...pending, days: 7, contacts: list.map(({ name, phone, rel }) => ({ name, phone, rel })) })); }
    catch (e) { fail(e); setBusy(false); }
  }

  return (
    <Page>
      {!edit && <View style={{ marginTop: 8 }}><Link title="‹ Back" onPress={onBack} /></View>}
      {!edit && <Text style={{ color: C.sub, fontWeight: '700', marginTop: 24, fontSize: 13 }}>STEP 2 OF 2</Text>}
      <H1 style={{ marginTop: edit ? 24 : 6 }}>{edit ? 'Your emergency contacts' : 'Who should we alert?'}</H1>
      <Sub>In an SOS they get an SMS with your live location. Your primary contact also gets a call.</Sub>

      <Card>
        <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Amma" style={{ marginTop: 0 }} />
        <Field label="Mobile number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="98765 43210" />
        <View style={{ marginTop: 14 }}>
          <Label>Relation</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {RELATIONS.map((r) => <Chip key={r} label={r} selected={rel === r} onPress={() => setRel(r)} />)}
          </View>
        </View>
        <Btn title="+ Add contact" kind="outline" onPress={add} />
      </Card>
      <Err>{err}</Err>

      {list.map((c, i) => (
        <Card key={c.id || c.phone} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, padding: 12 }}>
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: C.primary, fontWeight: '700', fontSize: 16 }}>{c.name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ color: C.text, fontWeight: '600', fontSize: 15 }}>
              {c.name}{i === 0 ? '  ' : ''}{i === 0 && <Text style={{ color: C.primary, fontSize: 11, fontWeight: '800' }}>PRIMARY</Text>}
            </Text>
            <Text style={{ color: C.sub, fontSize: 13, marginTop: 2 }}>{c.rel} · +91 {c.phone}</Text>
          </View>
          {i > 0 && <Pressable onPress={() => makePrimary(i)} hitSlop={8} style={{ marginRight: 14 }}><Text style={{ color: C.primary, fontSize: 13, fontWeight: '600' }}>Make primary</Text></Pressable>}
          <Pressable onPress={() => remove(i)} hitSlop={10}><Text style={{ color: C.sub, fontSize: 18 }}>✕</Text></Pressable>
        </Card>
      ))}
      <Text style={{ color: C.sub, fontSize: 13, marginTop: 12 }}>
        {list.length ? `${list.length} of 5 added${list.length < 2 ? ' · adding one more is recommended' : ''}` : 'Add at least 1 contact to continue.'}
      </Text>
      <Btn title={edit ? 'Done' : busy ? 'Creating account…' : 'Finish setup'} onPress={finish} disabled={busy} />
    </Page>
  );
}
