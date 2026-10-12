// GenAI calls (OpenAI-compatible: Groq by default). One free key (GROQ_API_KEY) enables the chatbot AND voice keyword detection.
const { AI } = require('./config');
const { getJSON } = require('./http');

const enabled = () => !!AI.key;
const auth = () => ({ Authorization: 'Bearer ' + AI.key });

async function chat(messages, { maxTokens = 380, temperature = 0.4 } = {}) {
  let last;
  for (const model of [AI.chatModel, AI.fallbackModel]) {          // if the main model was retired, try the backup
    try {
      const j = await getJSON(`${AI.base}/chat/completions`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }) }, 20000);
      const text = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
      if (text) return text.trim();
    } catch (e) { last = e; }
  }
  throw last || new Error('no answer');
}

// buffer = audio bytes (m4a), lang = 'en' | 'te' | 'hi' | ''
async function transcribe(buffer, mime, lang) {
  const fd = new FormData();
  fd.append('file', new Blob([buffer], { type: mime || 'audio/m4a' }), 'chunk.m4a');
  fd.append('model', AI.sttModel); fd.append('response_format', 'json'); fd.append('temperature', '0');
  if (lang) fd.append('language', lang);
  const j = await getJSON(`${AI.base}/audio/transcriptions`, { method: 'POST', headers: auth(), body: fd }, 20000);
  return String(j.text || '').trim();
}
module.exports = { enabled, chat, transcribe };
