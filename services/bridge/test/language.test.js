// The language module: each task tries its providers in order (Bhashini first, then Groq audio) and the
// caller falls back after all of them. Providers are faked here; nothing touches the network.
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const MOD = path.join(__dirname, '../src/providers/language.js');
const BH = path.join(__dirname, '../src/bhashini.js');
const GQ = path.join(__dirname, '../src/groqAudio.js');
const ENV = ['LANGUAGE_PROVIDER', 'SPEECH_TO_TEXT', 'TEXT_TO_SPEECH', 'TRANSLATION', 'BHASHINI_USER_ID', 'BHASHINI_ULCA_API_KEY', 'LLM_API_KEY', 'GROQ_API_KEY'];

let saved;
let calls;
function fakeProviders({ bhashini, groq }) {
  for (const p of [MOD, BH, GQ]) delete require.cache[p];
  require.cache[BH] = { id: BH, filename: BH, loaded: true, exports: bhashini };
  require.cache[GQ] = { id: GQ, filename: GQ, loaded: true, exports: groq };
  return require(MOD);
}
const ok = (name, value) => async args => { calls.push([name, args]); return value; };
const bad = name => async () => { calls.push([name, 'fail']); throw new Error(`${name} down`); };

beforeEach(() => {
  saved = Object.fromEntries(ENV.map(k => [k, process.env[k]]));
  for (const k of ENV) delete process.env[k];
  process.env.BHASHINI_USER_ID = 'u';
  process.env.BHASHINI_ULCA_API_KEY = 'k';
  process.env.LLM_API_KEY = 'g';
  calls = [];
});
afterEach(() => {
  for (const k of ENV) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  for (const p of [MOD, BH, GQ]) delete require.cache[p];
});

describe('language module: provider order and fallback', () => {
  it('speech to text: Bhashini first; when it fails, Groq Whisper answers; the source says which', async () => {
    const lang = fakeProviders({
      bhashini: { transcribe: bad('bhashini'), translate: ok('bh-tr', 'x'), speak: ok('bh-sp', {}) },
      groq: { transcribe: ok('groq', 'வணக்கம்'), speak: ok('gq-sp', {}), isConfigured: () => true },
    });
    const r = await lang.transcribeWithSource({ audioBase64: 'AAAA', language: 'ta' });
    assert.deepEqual(r, { out: 'வணக்கம்', source: 'groq' });
    assert.deepEqual(calls.map(c => c[0]), ['bhashini', 'groq']);
  });

  it('text to speech: Bhashini speaks Tamil; Groq Orpheus is English only, so for Tamil the chain ends with Bhashini\'s error', async () => {
    const lang = fakeProviders({
      bhashini: { transcribe: ok('bh', ''), translate: ok('bh', ''), speak: bad('bhashini') },
      groq: { transcribe: ok('gq', ''), speak: async ({ language }) => { calls.push(['groq', language]); if (language !== 'en') throw new Error('English only'); return { audioBase64: 'UklGRg==', format: 'wav' }; }, isConfigured: () => true },
    });
    await assert.rejects(lang.speak({ text: 'வணக்கம்', language: 'ta' }), /English only/);
    const en = await lang.speak({ text: 'Hello', language: 'en' });
    assert.equal(en.source, 'groq');
    assert.equal(en.audioBase64, 'UklGRg==');
  });

  it('the order is configurable, and a provider without keys is skipped', async () => {
    process.env.SPEECH_TO_TEXT = 'groq,bhashini';
    const lang = fakeProviders({
      bhashini: { transcribe: ok('bhashini', 'b'), translate: ok('bh', ''), speak: ok('bh', {}) },
      groq: { transcribe: ok('groq', 'g'), speak: ok('gq', {}), isConfigured: () => true },
    });
    assert.equal(await lang.transcribe({ audioBase64: 'AAAA', language: 'hi' }), 'g');
    delete process.env.LLM_API_KEY;
    const lang2 = fakeProviders({
      bhashini: { transcribe: ok('bhashini', 'b'), translate: ok('bh', ''), speak: ok('bh', {}) },
      groq: { transcribe: ok('groq', 'g'), speak: ok('gq', {}), isConfigured: () => false },
    });
    assert.equal(await lang2.transcribe({ audioBase64: 'AAAA', language: 'hi' }), 'b');
  });

  it('with no keys at all, or LANGUAGE_PROVIDER=none, every task throws at once and isConfigured is false', async () => {
    delete process.env.BHASHINI_USER_ID;
    delete process.env.LLM_API_KEY;
    const lang = fakeProviders({
      bhashini: { transcribe: ok('bh', 'x'), translate: ok('bh', 'x'), speak: ok('bh', {}) },
      groq: { transcribe: ok('gq', 'x'), speak: ok('gq', {}), isConfigured: () => false },
    });
    await assert.rejects(lang.transcribe({ audioBase64: 'AAAA', language: 'ta' }), /No transcribe provider/);
    await assert.rejects(lang.speak({ text: 'x', language: 'ta' }), /No speak provider/);
    assert.equal(lang.isConfigured(), false);
    assert.deepEqual(calls, []);
    process.env.BHASHINI_USER_ID = 'u';
    process.env.LANGUAGE_PROVIDER = 'none';
    const off = fakeProviders({ bhashini: { transcribe: ok('bh', 'x'), translate: ok('bh', 'x'), speak: ok('bh', {}) }, groq: { transcribe: ok('gq', 'x'), speak: ok('gq', {}), isConfigured: () => true } });
    await assert.rejects(off.translate({ text: 'x', from: 'ta' }), /none/);
    assert.equal(off.isConfigured(), false);
  });
});
