// One command to run everything:  npm start
//  1) starts the API (backend/)         2) starts Expo (mobile/)        3) prints the QR code for Expo Go
const { spawn } = require('child_process');
const os = require('os'), path = require('path'), fs = require('fs');
const qr = require('qrcode-terminal');

const ROOT = path.join(__dirname, '..'), BACK = path.join(ROOT, 'backend'), MOB = path.join(ROOT, 'mobile');
const DEV = process.argv.includes('--dev');          // npm start -- --dev   (development build, needed for Voice SOS)
let PORT_APP = 8081, API_PORT = +process.env.API_PORT || 5050;

// If a port is already taken (e.g. an old "npm start" is still running) use the next free one instead of crashing.
const net = require('net');
const isFree = (port) => new Promise((res) => { const s = net.createServer(); s.once('error', () => res(false)); s.once('listening', () => s.close(() => res(true))); s.listen(port, '0.0.0.0'); });
async function pickPort(start, label) {
  for (let p = start; p < start + 20; p++) if (await isFree(p)) { if (p !== start) console.log(`\x1b[33m[!] Port ${start} (${label}) is busy, probably an old SafePath window that is still running. Using ${p} instead. Close the old one to keep things tidy.\x1b[0m`); return p; }
  return start;
}

// first .env: copy the example so the backend has settings
const envFile = path.join(BACK, '.env');
if (!fs.existsSync(envFile) && fs.existsSync(path.join(BACK, '.env.example'))) fs.copyFileSync(path.join(BACK, '.env.example'), envFile);

function lanIp() {                       // the laptop's Wi-Fi address (phone must be on the same Wi-Fi)
  const all = [];
  for (const [name, list] of Object.entries(os.networkInterfaces()))
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) all.push({ name, ip: a.address });
  const score = (x) => (/^(wi-?fi|wlan|en0|wl)/i.test(x.name) ? 0 : 1) + (/^(vethernet|vmware|virtualbox|docker|wsl|vboxnet|utun|tailscale)/i.test(x.name) ? 5 : 0) + (/^192\.168\./.test(x.ip) ? 0 : 1);
  all.sort((a, b) => score(a) - score(b));
  return all.length ? all[0].ip : '127.0.0.1';
}
const IP = process.env.SAFEPATH_HOST || lanIp();

const kids = [];
function run(tag, color, cmd, args, cwd, env = {}) {
  const p = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  const out = (d) => String(d).replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').split(/\r?\n/).filter((l) => l.trim()).forEach((l) => console.log(`\x1b[${color}m[${tag}]\x1b[0m ${l}`));
  p.stdout.on('data', out); p.stderr.on('data', out);
  p.on('exit', (code) => { if (code && !closing) { console.log(`\x1b[31m[${tag}] stopped (code ${code})\x1b[0m`); shutdown(code); } });
  kids.push(p); return p;
}
let closing = false;
function shutdown(code = 0) {            // ask the API to close its database politely, then stop everything
  if (closing) return; closing = true;
  kids.forEach((k) => { try { k.connected ? k.send('shutdown') : k.kill(); } catch (e) {} });
  setTimeout(() => { kids.forEach((k) => { try { k.kill(); } catch (e) {} }); process.exit(code); }, 3500);
  const t = setInterval(() => { if (kids.every((k) => k.exitCode !== null || k.killed)) { clearInterval(t); process.exit(code); } }, 200);
}
process.on('SIGINT', () => shutdown(0)); process.on('SIGTERM', () => shutdown(0));

async function main() {
  PORT_APP = await pickPort(PORT_APP, 'app'); API_PORT = await pickPort(API_PORT, 'API');
  run('API', 34, process.execPath, ['server/index.js'], BACK, { API_PORT: String(API_PORT) });

  const expoCli = require.resolve('expo/bin/cli', { paths: [MOB] });
  // '--go' = always open in Expo Go (needed once expo-dev-client is installed); '--dev-client' = the development build
  // the app learns the API address from this variable (needed when the API had to move to another port)
  const app = run('APP', 35, process.execPath, [expoCli, 'start', '--lan', '--port', String(PORT_APP), ...(DEV ? ['--dev-client'] : ['--go']), '--clear'], MOB,
    { REACT_NATIVE_PACKAGER_HOSTNAME: IP, EXPO_PUBLIC_API_URL: `http://${IP}:${API_PORT}`, EXPO_NO_TELEMETRY: '1', EXPO_NO_DOCTOR: '1' });

  let shown = false;
  app.stdout.on('data', (d) => {
    if (shown || !/Waiting on|Metro waiting|Logs for your project/i.test(String(d))) return;
    shown = true;
    setTimeout(() => {
      const url = DEV ? `exp+safepath://expo-development-client/?url=${encodeURIComponent(`http://${IP}:${PORT_APP}`)}` : `exp://${IP}:${PORT_APP}`;
      console.log(DEV ? '\n  Open the SafePath development app on your phone, then scan this QR (or use the phone Camera):\n'
                      : '\n  Scan this QR code with the Expo Go app (Android) or the Camera app (iPhone):\n');
      qr.generate(url, { small: true }, (q) => console.log(q.split('\n').map((l) => '    ' + l).join('\n')));
      console.log(DEV ? `  or, in the development app, type:  http://${IP}:${PORT_APP}` : `  or type this in Expo Go:  ${url}`);
      console.log(`  API for the app:           http://${IP}:${API_PORT}   (phone and laptop must be on the same Wi-Fi)`);
      console.log('  Press Ctrl + C to stop everything.\n');
    }, 400);
  });
}
main();
