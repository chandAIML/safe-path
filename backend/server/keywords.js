// Distress words in English / Hindi / Telugu (Latin script AND native script, because speech engines return either).
//   STRONG words start an SOS by themselves.  WEAK words ("stop", "no") only count when shouted (loud) or repeated.
const STRONG_LATIN = ['help', 'help me', 'save me', 'bachao', 'bachaao', 'bachav', 'emergency', 'leave me alone', 'leave me', 'let me go', 'kapadandi', 'kapadu', 'sahayam', 'saayam', 'madad', 'chodo'];
const STRONG_NATIVE = ['కాపాడండి', 'కాపాడు', 'సహాయం', 'సాయం', 'రక్షించండి', 'హెల్ప్', 'వదిలేయండి', 'వదిలేయ్', 'బచావో', 'बचाओ', 'मदद', 'हेल्प', 'बचाइए', 'छोड़ो', 'छोड़ दो'];
const WEAK_LATIN = ['stop', 'no', 'dont touch', 'don\'t touch', 'go away', 'back off', 'aapandi', 'vaddu', 'ruko', 'hato'];
const WEAK_NATIVE = ['ఆపండి', 'ఆపు', 'వద్దు', 'రుకో', 'रुको', 'हटो', 'नहीं'];
const BIAS = [...STRONG_LATIN, ...STRONG_NATIVE];

const find = (text, list) => list.find((w) => new RegExp('(^|[^a-z])' + w.replace(/'/g, "['’]?").replace(/ /g, '\\s+') + '($|[^a-z])').test(text));
const count = (text, w) => (text.match(new RegExp('(^|[^a-z])' + w.replace(/ /g, '\\s+') + '(?![a-z])', 'g')) || []).length;

// -> { level: 'sos' | 'warn' | null, word }
function analyse(text, loud) {
  const t = String(text || '').toLowerCase().trim();
  if (!t) return { level: null, word: null };
  const s = find(t, STRONG_LATIN) || STRONG_NATIVE.find((w) => t.includes(w));
  if (s) return { level: 'sos', word: s };
  const w = find(t, WEAK_LATIN) || WEAK_NATIVE.find((x) => t.includes(x));
  if (w) {
    const repeated = (WEAK_LATIN.includes(w) ? count(t, w) : t.split(w).length - 1) >= 2;
    return { level: loud || repeated ? 'sos' : 'warn', word: w };
  }
  return { level: null, word: null };
}
module.exports = { analyse, BIAS };
