import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Page, H1, Sub, Err, Field, Btn, Link } from '../ui';
import { C } from '../theme';
import { ph } from '../util';

export default function Register({ onNext, onBack }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');

  function next() {
    const p = ph(phone), m = email.trim();
    if (name.trim().length < 2) return setErr('Enter your full name.');
    if (!p) return setErr('Enter a valid 10-digit mobile number.');
    if (m && !/^\S+@\S+\.\S+$/.test(m)) return setErr('That email doesn’t look right.');
    if (pw.length < 6) return setErr('Password needs at least 6 characters.');
    setErr(''); onNext({ name: name.trim(), phone: p, email: m, password: pw });
  }

  return (
    <Page>
      <View style={{ marginTop: 8 }}><Link title="‹ Back to sign in" onPress={onBack} /></View>
      <Text style={{ color: C.sub, fontWeight: '700', marginTop: 24, fontSize: 13 }}>STEP 1 OF 2</Text>
      <H1 style={{ marginTop: 6 }}>Create your account</H1>
      <Sub>Next, you’ll choose who we alert in an emergency.</Sub>
      <Field label="Full name" value={name} onChangeText={setName} placeholder="Your name" />
      <Field label="Mobile number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="98765 43210" />
      <Field label="Email (optional)" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@mail.com" />
      <Field label="Password" value={pw} onChangeText={setPw} secureTextEntry placeholder="At least 6 characters" />
      <Err>{err}</Err>
      <Btn title="Next: emergency contacts" onPress={next} />
    </Page>
  );
}
