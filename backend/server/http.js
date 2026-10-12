// Small helpers for calling outside services with a time limit and backup addresses.
const UA = { 'User-Agent': 'SafePath/3.0 (student project)' };

async function getJSON(url, opt = {}, ms = 12000) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { ...opt, signal: ctl.signal });
    if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
    return await r.json();
  } finally { clearTimeout(t); }
}
async function firstOk(list, fn) {          // try each address until one works
  let last;
  for (const x of list) { try { return await fn(x); } catch (e) { last = e; } }
  throw last || new Error('no service available');
}
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
module.exports = { UA, getJSON, firstOk, withTimeout };
