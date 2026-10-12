// Talks to the Express + MongoDB backend. Keeps the login session in the phone's secure storage.
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

let session = null;       // { token, exp, user }
let contacts = [];        // cached emergency contacts (so the app still shows them offline)
let serverOverride = null;
let onExpire = () => {};

export const setOnExpire = (f) => { onExpire = f; };
export const getSession = () => session;
export const getContacts = () => contacts;

// The backend runs on your laptop. Expo already knows the laptop's Wi-Fi IP (it is the address
// the QR code points to), so we reuse it and just switch the port to 5050.
function defaultBase() {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  const host = (Constants.expoConfig && Constants.expoConfig.hostUri) || '';
  const ip = host.split(':')[0] || 'localhost';
  return `http://${ip}:5050`;
}
export const getBase = () => serverOverride || defaultBase();

export async function loadStored() {
  const [s, c, o] = await Promise.all([
    SecureStore.getItemAsync('sp_session'), SecureStore.getItemAsync('sp_ct'), SecureStore.getItemAsync('sp_server'),
  ]);
  try { session = s ? JSON.parse(s) : null; contacts = c ? JSON.parse(c) : []; } catch (e) { session = null; contacts = []; }
  serverOverride = o || null;
  return session;
}
export async function saveSession(s) { session = s; await SecureStore.setItemAsync('sp_session', JSON.stringify(s)); }
export async function clearSession() {
  session = null; contacts = [];
  await Promise.all([SecureStore.deleteItemAsync('sp_session'), SecureStore.deleteItemAsync('sp_ct')]);
}
export async function setBase(url) {
  serverOverride = url || null;
  if (url) await SecureStore.setItemAsync('sp_server', url); else await SecureStore.deleteItemAsync('sp_server');
}
export async function setContacts(list) { contacts = list; await SecureStore.setItemAsync('sp_ct', JSON.stringify(list)); }

async function timeoutFetch(url, opt, ms) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(url, { ...opt, signal: ctl.signal }); } finally { clearTimeout(t); }
}

export async function api(method, path, body, ms = 10000) {
  const headers = { 'Content-Type': 'application/json' };
  if (session && session.token) headers.Authorization = 'Bearer ' + session.token;
  let res;
  try {
    res = await timeoutFetch(getBase() + '/api' + path, { method, headers, body: body ? JSON.stringify(body) : undefined }, ms);
  } catch (e) {
    const err = new Error(`Can’t reach the server at ${getBase()}. Is it running, and is your phone on the same Wi-Fi?`);
    err.status = 0; throw err;
  }
  const text = await res.text();
  let j = {}; try { j = JSON.parse(text); } catch (e) { /* not JSON */ }
  if (!res.ok) {
    // If the reply isn't from our API (no "error" field) show the HTTP status and a bit of the reply, so the cause is visible.
    const err = new Error(j.error || `Server replied HTTP ${res.status}: ${text.replace(/<[^>]*>/g, ' ').trim().slice(0, 100)}`); err.status = res.status;
    if (res.status === 401 && !/^\/auth\/(login|register)/.test(path)) onExpire();
    throw err;
  }
  return j;
}
// Multipart upload (video / audio). Don't set Content-Type: the phone adds the multipart boundary itself.
export async function upload(path, formData, ms = 60000) {
  const headers = {}; if (session && session.token) headers.Authorization = 'Bearer ' + session.token;
  let res;
  try { res = await timeoutFetch(getBase() + '/api' + path, { method: 'POST', headers, body: formData }, ms); }
  catch (e) { const err = new Error('Can’t reach the server.'); err.status = 0; throw err; }
  const text = await res.text(); let j = {}; try { j = JSON.parse(text); } catch (e) { /* not JSON */ }
  if (!res.ok) { const err = new Error(j.error || `Server replied HTTP ${res.status}`); err.status = res.status; err.body = j; throw err; }
  return j;
}
export async function setSessionUser(user) { if (session) await saveSession({ ...session, user }); }
export async function loadContacts() { const r = await api('GET', '/contacts'); await setContacts(r.contacts); return r.contacts; }
