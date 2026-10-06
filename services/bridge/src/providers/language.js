// The language module: speech to text, translation and text to speech behind one small interface, so the
// provider can be swapped. LANGUAGE_PROVIDER=bhashini (default) | none. With `none`, or with no Bhashini
// keys, every call throws at once and the caller uses its fallback (typing, the original words, the
// browser's own speechSynthesis).
const bhashini = require('../bhashini');

const PROVIDERS = {
  bhashini,
  none: {
    transcribe: async () => { throw new Error('No speech provider'); },
    translate: async () => { throw new Error('No translation provider'); },
    speak: async () => { throw new Error('No speech provider'); },
  },
};

const current = () => PROVIDERS[process.env.LANGUAGE_PROVIDER || 'bhashini'] || PROVIDERS.none;

module.exports = {
  transcribe: args => current().transcribe(args),   // { audioBase64, language, samplingRate } → text
  translate: args => current().translate(args),     // { text, from, to } → text
  speak: args => current().speak(args),             // { text, language } → { audioBase64, format, samplingRate }
  isConfigured: () => (process.env.LANGUAGE_PROVIDER || 'bhashini') === 'bhashini'
    && Boolean(process.env.BHASHINI_USER_ID && process.env.BHASHINI_ULCA_API_KEY),
};
