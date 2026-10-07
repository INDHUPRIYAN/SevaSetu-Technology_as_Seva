// The language module: speech to text, translation and text to speech behind one small interface, so the
// provider can be swapped. Each task tries its providers in order and uses the first that answers; the
// caller's own fallback (typing, the original words, the browser's speechSynthesis) comes after all of them.
//
//   SPEECH_TO_TEXT=bhashini,groq     Bhashini ASR (Indian-language models; exact on Tamil and Hindi in our
//                                    checks), then Groq Whisper large-v3 (multilingual)
//   TEXT_TO_SPEECH=bhashini,groq     Bhashini TTS (ta / hi / en), then Groq Orpheus (English only)
//   TRANSLATION=bhashini             Bhashini; with none, words go to the model untranslated
//   LANGUAGE_PROVIDER=none           turns every provider off
const bhashini = require('../bhashini');
const groq = require('../groqAudio');

const PROVIDERS = { bhashini, groq };
const off = () => process.env.LANGUAGE_PROVIDER === 'none';

function chain(envName, fallback) {
  const names = (process.env[envName] || fallback).split(',').map(s => s.trim()).filter(Boolean);
  return names.filter(n => PROVIDERS[n]).map(n => [n, PROVIDERS[n]]);
}
const configured = ([name]) => (name === 'bhashini'
  ? Boolean(process.env.BHASHINI_USER_ID && process.env.BHASHINI_ULCA_API_KEY)
  : groq.isConfigured());

// try each provider that has keys, in order; throw the last error if none answered
async function first(task, envName, fallback, args) {
  if (off()) throw new Error(`No ${task} provider (LANGUAGE_PROVIDER=none)`);
  const list = chain(envName, fallback).filter(configured);
  if (!list.length) throw new Error(`No ${task} provider is set up`);
  let lastError;
  for (const [name, p] of list) {
    try {
      const out = await p[task](args);
      return { out, source: name };
    } catch (e) { lastError = e; }
  }
  throw lastError;
}

module.exports = {
  // { audioBase64, language, samplingRate, audioFormat } → text
  transcribe: async args => (await first('transcribe', 'SPEECH_TO_TEXT', 'bhashini,groq', args)).out,
  transcribeWithSource: args => first('transcribe', 'SPEECH_TO_TEXT', 'bhashini,groq', args),
  // { text, from, to } → text
  translate: async args => (await first('translate', 'TRANSLATION', 'bhashini', args)).out,
  // { text, language } → { audioBase64, format, samplingRate, source }
  speak: async args => { const { out, source } = await first('speak', 'TEXT_TO_SPEECH', 'bhashini,groq', args); return { ...out, source }; },
  // any speech provider (to text or to speech) has keys
  isConfigured: () => !off() && (chain('SPEECH_TO_TEXT', 'bhashini,groq').some(configured) || chain('TEXT_TO_SPEECH', 'bhashini,groq').some(configured)),
  isTranslationConfigured: () => !off() && chain('TRANSLATION', 'bhashini').some(configured),
};
