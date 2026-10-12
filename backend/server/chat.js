// AI Safety Chatbot: the user explains the situation, the bot analyses it and suggests what to do.
//  - With GROQ_API_KEY: a real LLM (Llama) answers, in the user's language, knowing the time and nearby help.
//  - Without a key (or if the LLM is down): a built-in rule-based advisor answers, so the chatbot never fails during a demo.
const express = require('express');
const { requireAuth } = require('./auth');
const ai = require('./ai');
const { nearbyZones } = require('./zones');
const { withTimeout } = require('./http');
const { istNow } = require('./weather');
const router = express.Router();
router.use(requireAuth);

const URGENT = /(follow(ing|ed)? me|chas(e|ing) me|grab(bed|bing)?|attack|knife|kidnap|trapped|locked|forc(e|ing)|touch(ing)? me|molest|threat|drunk|help me|save me|abduct|rape|ఫాలో|వెంబడ|వెంటాడ|దాడి|కిడ్నాప్|బంధ|బెదిరి|పట్టుకు|कोई पीछा|पीछा कर|हमला|धमकी|बचाओ)/i;
const TELUGU = /[\u0C00-\u0C7F]/;
const TOPICS = [
  { re: /(cab|taxi|auto|uber|ola|rapido|driver|rickshaw|wrong route|cab driver)/i, en: 'Stay calm and do not argue.\n1. Share your live location with a family member right now (SafePath SOS contacts can see it).\n2. Ask the driver to stop at the nearest lit, crowded place (petrol bunk, shop, bus stand). Do not get out in an isolated place.\n3. Note the vehicle number and driver details; send them to someone you trust.\n4. If the driver refuses or the route stays wrong, call 112 and use SOS in SafePath.' },
  { re: /(stalk|obsess|online|instagram|whatsapp|message|photos|morph|cyber|blackmail)/i, en: 'It is not your fault, and you can act.\n1. Do not reply or delete anything. Take screenshots with dates and numbers.\n2. Block the person and tell a trusted family member or friend.\n3. Report online abuse at cybercrime.gov.in or call 1930. For physical stalking call 1091 (Women Helpline) or 112.\n4. Use the SafePath Evidence feature if they contact you in person.' },
  { re: /(tease|harass|comment|whistl|touch|grope|staring|catcall|eve)/i, en: 'You did nothing wrong.\n1. Move away toward people (a shop, a family, a security guard).\n2. If safe, note the time and place and take a photo or record audio as proof.\n3. Report to the nearest police station, or call 112 / 1091. The SafePath Evidence feature saves video, audio and GPS.\n4. Tell someone you trust so you are not alone with it.' },
  { re: /(domestic|husband|in-laws|beat|abuse at home|violence at home)/i, en: 'Your safety matters most.\n1. If you are in danger right now, go to a neighbour or a safe place and call 112.\n2. Women Helpline 181 and 1091 give free confidential help and can send support to you.\n3. Keep your phone charged and tell a trusted person your plan.\n4. One Stop Centres (Sakhi) offer shelter, medical and legal help.' },
  { re: /(night|alone|dark|walking|late|lonely|unsafe|scared|afraid|feel)/i, en: 'Let us make this walk safer.\n1. Share live location with a family member and start a SafePath check-in timer.\n2. Stay on main, well-lit roads even if longer. Use the Safe Route feature to pick the safest path.\n3. Keep earphones off, phone charged and in your hand.\n4. If someone makes you uneasy, walk into the nearest open shop or petrol bunk and press SOS if needed.' },
];
const TELUGU_URGENT = 'నేను ఉన్నాను. మీ భద్రత మొదట.\n1. వెలుతురు ఉన్న, జనం ఎక్కువగా ఉన్న చోటికి (షాప్, పెట్రోల్ బంక్, ఆసుపత్రి, బస్టాండ్) వెళ్లండి.\n2. వెంటనే 112 కి కాల్ చేయండి.\n3. SafePath లో SOS నొక్కండి, మీ కుటుంబానికి లైవ్ లొకేషన్ వెళ్తుంది.\n4. నిర్మానుష్యమైన, చీకటి రోడ్డు వైపు వెళ్లకండి.';
const TELUGU_GENERAL = 'మీ పరిస్థితి చెప్పండి, నేను సహాయం చేస్తాను.\n1. వెలుతురు ఉన్న, జనం ఉన్న చోట ఉండండి.\n2. కుటుంబ సభ్యులకు మీ లైవ్ లొకేషన్ పంపండి.\n3. ప్రమాదం అనిపిస్తే 112 కి కాల్ చేయండి లేదా SafePath లో SOS నొక్కండి.\nమహిళా హెల్ప్‌లైన్: 1091 / 181.';

function ruleReply(text, places) {
  const te = TELUGU.test(text), urgent = URGENT.test(text);
  let body;
  if (urgent) body = te ? TELUGU_URGENT : 'I am here with you. Your safety comes first.\n1. Move toward a lit, crowded place (shop, petrol bunk, hospital, bus stand). Do not take a dark or quiet road.\n2. Call 112 now and keep the phone in your hand.\n3. Press SOS in SafePath so your contacts get your live location.\n4. Make noise and draw attention if someone grabs or follows you.';
  else { const t = TOPICS.find((x) => x.re.test(text)); body = t ? t.en : te ? TELUGU_GENERAL : 'Tell me more about what is happening: where you are, whether someone is near you, and if you feel in danger right now.\nMeanwhile: stay in a lit, crowded place, share your live location with family, and call 112 if you feel unsafe. Women Helplines: 1091 and 181.'; }
  if (places) body += '\n\n' + places;
  return { reply: body, sos: urgent, source: 'rules' };
}

async function placesLine(lat, lng) {
  try {
    const z = await withTimeout(nearbyZones(lat, lng, 2000), 2500);
    const pick = (t) => z.find((x) => x.t === t), parts = [];
    const p = pick('P'), h = pick('H'), g = pick('G'), s = pick('S');
    if (p) parts.push(`Police: ${p.n || 'station'} (${p.dist} m)`);
    if (h) parts.push(`Hospital/pharmacy: ${h.n || 'nearby'} (${h.dist} m)`);
    if (g) parts.push(`Petrol bunk: ${g.n || 'nearby'} (${g.dist} m)`);
    if (s) parts.push(`24h store: ${s.n || 'nearby'} (${s.dist} m)`);
    return parts.length ? 'Nearest help: ' + parts.join(' · ') : '';
  } catch (e) { return ''; }
}

router.post('/', async (req, res) => {
  const b = req.body || {};
  const msgs = (Array.isArray(b.messages) ? b.messages : []).filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string').slice(-10).map((m) => ({ role: m.role, content: m.content.slice(0, 1200) }));
  const last = [...msgs].reverse().find((m) => m.role === 'user');
  if (!last) return res.status(400).json({ error: 'Type your message first.' });
  const c = b.context || {}, has = typeof c.lat === 'number' && typeof c.lng === 'number';
  const places = has ? await placesLine(c.lat, c.lng) : '';
  const urgent = URGENT.test(last.content);

  if (ai.enabled()) {
    const hour = typeof c.hour === 'number' ? c.hour : istNow();
    const system = 'You are SafePath, a calm safety assistant for women in India. The user describes a situation; analyse it and give practical suggestions. ' +
      'Rules: max 110 words, plain text (no markdown), short numbered steps, immediate safety first (move to a lit, crowded place; call 112 police / 1091 women helpline / 181; share live location; use the SafePath SOS button). ' +
      'Never blame the user, never promise police action, do not ask for personal details. If the user is in IMMEDIATE danger (followed, grabbed, threatened, attacked, trapped) start your reply with the exact tag [SOS]. ' +
      'Reply in the same language the user writes (English, Telugu, Hindi, or mixed). ' + `Local time is about ${Math.floor(hour)}:${String(Math.round((hour % 1) * 60)).padStart(2, '0')}. ` + (places ? places + '. Mention the nearest helpful place if relevant.' : '');
    try {
      let text = await ai.chat([{ role: 'system', content: system }, ...msgs]);
      const tag = /^\s*\[SOS\]\s*/i.test(text); text = text.replace(/^\s*\[SOS\]\s*/i, '');
      return res.json({ reply: text, sos: tag || urgent, source: 'ai' });
    } catch (e) { /* fall back to rules */ }
  }
  res.json(ruleReply(last.content, places));
});
module.exports = { router, ruleReply };
