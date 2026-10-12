// Sends SMS / voice calls. Default provider "console" only logs (safe for development).
// Set SMS_PROVIDER=twilio and the TWILIO_* variables in .env for real messages.
// NOTE: the Twilio branch needs a real account to verify - it is not tested here.
const provider = () => process.env.SMS_PROVIDER || 'console';
const e164 = n => '+91' + n;
const esc = s => String(s).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));

async function twilio(resource, form) {
  const sid = process.env.TWILIO_SID, tok = process.env.TWILIO_TOKEN;
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/${resource}.json`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(sid + ':' + tok).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form)
  });
  return r.ok;
}
async function sms(to, text) {
  if (provider() === 'twilio') {
    try { return { ok: await twilio('Messages', { To: e164(to), From: process.env.TWILIO_FROM, Body: text }) }; }
    catch (e) { return { ok: false }; }
  }
  console.log(`[sms simulated] to ${to}: ${text}`);
  return { ok: true, simulated: true };
}
async function call(to, say) {
  if (provider() === 'twilio') {
    try { return { ok: await twilio('Calls', { To: e164(to), From: process.env.TWILIO_FROM, Twiml: `<Response><Say>${esc(say)}</Say></Response>` }) }; }
    catch (e) { return { ok: false }; }
  }
  console.log(`[call simulated] to ${to}: ${say}`);
  return { ok: true, simulated: true };
}
module.exports = { sms, call };
