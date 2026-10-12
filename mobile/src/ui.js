// Small shared UI pieces so every screen looks the same.
import React from 'react';
import { View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from './theme';

export function Page({ children, scroll = true }) {
  const body = scroll
    ? <ScrollView contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">{children}</ScrollView>
    : <View style={[s.pad, { flex: 1 }]}>{children}</View>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>{body}</KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export const H1 = ({ children, style }) => <Text style={[s.h1, style]}>{children}</Text>;
export const Sub = ({ children, style }) => <Text style={[s.sub, style]}>{children}</Text>;
export const Err = ({ children }) => (children ? <Text style={s.err}>{children}</Text> : null);
export const Card = ({ children, style }) => <View style={[s.card, style]}>{children}</View>;
export const Label = ({ children }) => <Text style={s.label}>{children}</Text>;

export function Field({ label, error, style, ...props }) {
  return (
    <View style={{ marginTop: 14 }}>
      {label ? <Label>{label}</Label> : null}
      <TextInput placeholderTextColor="#9AA4B2" style={[s.input, error && { borderColor: C.danger }, style]} {...props} />
    </View>
  );
}

export function Btn({ title, onPress, kind = 'primary', disabled, style }) {
  const k = {
    primary: { bg: C.primary, fg: '#fff', bd: C.primary },
    outline: { bg: C.card, fg: C.primary, bd: C.primary },
    ghost: { bg: 'transparent', fg: C.sub, bd: C.line },
    danger: { bg: C.danger, fg: '#fff', bd: C.danger },
  }[kind];
  return (
    <Pressable onPress={onPress} disabled={disabled}
      style={({ pressed }) => [s.btn, { backgroundColor: k.bg, borderColor: k.bd, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }, style]}>
      <Text style={[s.btnText, { color: k.fg }]}>{title}</Text>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, selected && { backgroundColor: C.primarySoft, borderColor: C.primary }]}>
      <Text style={{ color: selected ? C.primary : C.sub, fontWeight: '600', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

export function Bar({ value, color, label, note }) {       // value 0..1
  return (
    <View style={{ marginTop: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: C.text, fontSize: 13, fontWeight: '600' }}>{label}</Text>
        <Text style={{ color: C.sub, fontSize: 12 }}>{note}</Text>
      </View>
      <View style={{ height: 7, borderRadius: 4, backgroundColor: C.line, marginTop: 5, overflow: 'hidden' }}>
        <View style={{ height: 7, width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`, backgroundColor: color }} />
      </View>
    </View>
  );
}

// Shows `fallback` instead of crashing the whole app when one feature fails.
export class Boundary extends React.Component {
  state = { err: null };
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (!this.state.err) return this.props.children;
    const f = this.props.fallback;
    return typeof f === 'function' ? f(this.state.err, () => this.setState({ err: null })) : f || null;
  }
}

export const Link = ({ title, onPress }) => (
  <Pressable onPress={onPress} hitSlop={10}><Text style={{ color: C.primary, fontWeight: '600', fontSize: 15 }}>{title}</Text></Pressable>
);

const s = StyleSheet.create({
  pad: { padding: 20, paddingBottom: 48 },
  h1: { fontSize: 28, fontWeight: '700', color: C.text },
  sub: { fontSize: 15, color: C.sub, marginTop: 6, lineHeight: 21 },
  err: { color: C.danger, marginTop: 12, fontSize: 14 },
  label: { fontSize: 13, fontWeight: '600', color: C.sub, marginBottom: 6 },
  card: { backgroundColor: C.card, borderRadius: 14, padding: 16, marginTop: 16, borderWidth: 1, borderColor: C.line },
  input: { backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: C.text },
  btn: { borderRadius: 10, borderWidth: 1.5, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  btnText: { fontSize: 16, fontWeight: '700' },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.card, marginRight: 8, marginTop: 8 },
});
