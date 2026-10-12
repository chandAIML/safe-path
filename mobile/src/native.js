// Native modules are loaded safely: if one is missing on a phone, only THAT feature switches off, the app still opens.
const opt = (fn) => { try { return fn(); } catch (e) { return null; } };
export const SMS = opt(() => require('expo-sms'));
export const CameraMod = opt(() => require('expo-camera'));
export const AudioMod = opt(() => require('expo-audio'));
export const SensorsMod = opt(() => require('expo-sensors'));
export const WebViewMod = opt(() => require('react-native-webview'));
