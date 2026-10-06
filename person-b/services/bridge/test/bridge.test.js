// Endpoints 28–29 — plan section 9.2, tests B1–B9, B11–B14, with Groq and Bhashini replaced by fakes.
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createApp } = require('../src/app');
const { DRAFT_KEYS } = require('../src/draft');
const FALLBACK = require('../src/fallbackDraft.json');

const COORD = { 'x-user-id': '650000000000000000000004', 'x-user-role': 'coordinator' };
const VOL = { 'x-user-id': '650000000000000000000002', 'x-user-role': 'volunteer' };
const B1_TEXT = '12 students of class 6 to 8 want help reading English aloud, Saturday mornings at the government school in Kanchipuram';
const TAMIL = 'காஞ்சிபுரம் அரசுப் பள்ளியில் 6 முதல் 8 ஆம் வகுப்பு படிக்கும் 12 மாணவர்கள் சனிக்கிழமை காலை ஆங்கிலம் உரக்கப் படிக்க உதவி வேண்டும்';
const AI_CARD = {
  title: 'Reading English Aloud', want: 'A group of 12 students would like to read English aloud.',
  serveUsWell: 'Be patient.', youWillLearn: 'How to listen.', groupSize: 12, interestTags: ['teaching'],
  rhythm: { day: 'Saturday', start: '09:30', end: '11:00' }, weeks: 4, place: 'Government School, Kanchipuram',
};

// A fake provider that records what it was called with
function fake(impl) {
  const calls = [];
  const fn = async (...args) => { calls.push(args); return impl(...args); };
  fn.calls = calls;
  return fn;
}

const never = () => new Promise(() => {});
const boom = () => { throw new Error('provider down'); };

function appWith(deps) {
  return createApp({
    callLLM: fake(() => JSON.stringify(AI_CARD)),
    translate: fake(() => 'At the government school in Kanchipuram, 12 students of class 6 to 8 need help reading English aloud on Saturday mornings'),
    transcribe: fake(() => 'வணக்கம்'),
    ...deps,
  });
}

const draft = (app, body, headers = COORD) => request(app).post('/api/bridge/draft-need').set(headers).send(body);

describe('health', () => {
  it('GET /health', async () => {
    const res = await request(createApp()).get('/health');
    assert.deepEqual(res.body, { ok: true, service: 'bridge' });
  });
});

describe('28. POST /api/bridge/draft-need', () => {
  it('B1: an English sentence gives a draft with exactly the 9 keys and source "ai"', async () => {
    const callLLM = fake(() => JSON.stringify(AI_CARD));
    const res = await draft(appWith({ callLLM }), { text: B1_TEXT, language: 'en' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.source, 'ai');
    assert.deepEqual(Object.keys(res.body.data.draft).sort(), [...DRAFT_KEYS].sort());
    assert.deepEqual(res.body.data.draft, AI_CARD);
    assert.deepEqual(res.body.data.privacyFlags, []);
    assert.equal(callLLM.calls[0][1], B1_TEXT, 'English goes to Groq as it is');
  });

  it('B2: Tamil is translated by Bhashini first; Groq gets the English plus the original', async () => {
    const translate = fake(() => 'twelve students need help reading English');
    const callLLM = fake(() => JSON.stringify(AI_CARD));
    const res = await draft(appWith({ translate, callLLM }), { text: TAMIL, language: 'ta' });
    assert.equal(res.status, 200);
    assert.deepEqual(translate.calls[0][0], { text: TAMIL, from: 'ta' });
    assert.equal(callLLM.calls[0][1], `twelve students need help reading English\n\nOriginal: ${TAMIL}`);
    assert.equal(callLLM.calls[0][2], 'ta');
    assert.equal(res.body.data.draft.groupSize, 12);
  });

  it('B11: if Bhashini fails, Groq reads the Tamil directly and the draft still comes back', async () => {
    const callLLM = fake(() => JSON.stringify(AI_CARD));
    const res = await draft(appWith({ translate: fake(boom), callLLM }), { text: TAMIL, language: 'ta' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.source, 'ai');
    assert.equal(callLLM.calls[0][1], TAMIL);
  });

  it('B11: a Bhashini that hangs is given up on after the translate timeout', async () => {
    const callLLM = fake(() => JSON.stringify(AI_CARD));
    const app = appWith({ translate: fake(never), callLLM, translateTimeoutMs: 50 });
    const res = await draft(app, { text: TAMIL, language: 'ta' });
    assert.equal(res.status, 200);
    assert.equal(callLLM.calls[0][1], TAMIL);
  });

  it('B4: a volunteer is blocked with 403, and so is a call with no role', async () => {
    const callLLM = fake(() => JSON.stringify(AI_CARD));
    const app = appWith({ callLLM });
    assert.equal((await draft(app, { text: B1_TEXT }, VOL)).status, 403);
    assert.equal((await draft(app, { text: B1_TEXT }, {})).status, 403);
    assert.equal(callLLM.calls.length, 0, 'the AI is never called for a volunteer');
  });

  it('B5: empty or blank text gives 400', async () => {
    for (const body of [{ text: '' }, { text: '   ' }, {}, { text: 42 }]) {
      const res = await draft(appWith(), body);
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.equal(res.body.error.message, 'Please say or type the need');
    }
  });

  it('an unknown language or a very long text gives 400', async () => {
    assert.equal((await draft(appWith(), { text: B1_TEXT, language: 'fr' })).status, 400);
    assert.equal((await draft(appWith(), { text: 'a'.repeat(5001) })).status, 400);
  });

  it('B6: "Ravi, a poor boy, father\'s income is Rs 5000" gives at least 2 warnings', async () => {
    const res = await draft(appWith({ callLLM: fake(boom) }), { text: "Ravi, a poor boy, father's income is Rs 5000", language: 'en' });
    assert.equal(res.status, 200);
    assert.ok(res.body.data.privacyFlags.length >= 2, JSON.stringify(res.body.data.privacyFlags));
    assert.ok(res.body.data.privacyFlags.includes('Mentions money or income'));
    assert.ok(res.body.data.privacyFlags.includes('Uses a word we avoid (poor / needy / beneficiary)'));
  });

  it('B6: words the AI puts in the draft are checked too', async () => {
    const callLLM = fake(() => JSON.stringify({ ...AI_CARD, want: 'Help for needy children' }));
    const res = await draft(appWith({ callLLM }), { text: B1_TEXT });
    assert.deepEqual(res.body.data.privacyFlags, ['Uses a word we avoid (poor / needy / beneficiary)']);
  });

  it('B7 (safety net): the fallback draft names no person, no income and no word we avoid', () => {
    const text = JSON.stringify(FALLBACK);
    assert.doesNotMatch(text, /Ravi|income|₹|\brs\b|poor|needy|beneficiar/i);
  });

  it('B8: with no GROQ_API_KEY the real client fails fast and the fallback comes back within 1 second', async () => {
    const saved = process.env.GROQ_API_KEY;
    delete process.env.GROQ_API_KEY;
    try {
      const started = Date.now();
      const res = await draft(createApp({ translate: fake(boom) }), { text: B1_TEXT, language: 'en' });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.source, 'fallback');
      assert.deepEqual(res.body.data.draft, FALLBACK);
      assert.ok(Date.now() - started < 1000, `${Date.now() - started} ms`);
    } finally {
      if (saved !== undefined) process.env.GROQ_API_KEY = saved;
    }
  });

  it('B9: a slow AI is cut off at the timeout and the fallback comes back', async () => {
    const res = await draft(appWith({ callLLM: fake(never), draftTimeoutMs: 1 }), { text: B1_TEXT });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.source, 'fallback');
  });

  it('an AI answer that is not JSON falls back', async () => {
    const res = await draft(appWith({ callLLM: fake(() => 'Sorry, I cannot help with that') }), { text: B1_TEXT });
    assert.equal(res.body.data.source, 'fallback');
  });

  it('an AI answer with missing or wrong-typed keys still gives all 9 keys, typed', async () => {
    const callLLM = fake(() => JSON.stringify({ title: '  Reading  ', groupSize: '12', interestTags: 'x', rhythm: null, extra: 1 }));
    const res = await draft(appWith({ callLLM }), { text: B1_TEXT });
    const d = res.body.data.draft;
    assert.deepEqual(Object.keys(d).sort(), [...DRAFT_KEYS].sort());
    assert.equal(d.title, 'Reading');
    assert.equal(d.groupSize, 12);
    assert.deepEqual(d.interestTags, []);
    assert.deepEqual(d.rhythm, { day: '', start: '', end: '' });
    assert.equal(d.weeks, 4);
  });

  it('the fallback draft has the same 9 keys the AI must return', () => {
    assert.deepEqual(Object.keys(FALLBACK).sort(), [...DRAFT_KEYS].sort());
    assert.deepEqual(DRAFT_KEYS.slice().sort(), require('../src/llm').DRAFT_SCHEMA.required.slice().sort());
  });
});

describe('29. POST /api/bridge/transcribe', () => {
  const WAV = Buffer.from('RIFF....WAVEfmt ').toString('base64');
  const transcribeCall = (app, body, headers = VOL) => request(app).post('/api/bridge/transcribe').set(headers).send(body);

  it('B12: base64 WAV in, Tamil words out, for a volunteer or a coordinator', async () => {
    const transcribe = fake(() => '  வணக்கம்  ');
    const app = appWith({ transcribe });
    for (const headers of [VOL, COORD]) {
      const res = await transcribeCall(app, { audio: WAV, language: 'ta', samplingRate: 16000 }, headers);
      assert.equal(res.status, 200);
      assert.deepEqual(res.body.data, { text: 'வணக்கம்' });
    }
    assert.deepEqual(transcribe.calls[0][0], { audioBase64: WAV, language: 'ta', samplingRate: 16000 });
  });

  it('language defaults to Tamil and the rate to 16000', async () => {
    const transcribe = fake(() => 'x');
    await transcribeCall(appWith({ transcribe }), { audio: WAV });
    assert.deepEqual(transcribe.calls[0][0], { audioBase64: WAV, language: 'ta', samplingRate: 16000 });
  });

  it('B13: no audio gives 400', async () => {
    const res = await transcribeCall(appWith(), {});
    assert.equal(res.status, 400);
    assert.equal(res.body.error.message, 'No audio');
  });

  it('audio that is not base64, a bad language or a bad rate gives 400', async () => {
    assert.equal((await transcribeCall(appWith(), { audio: 'not base64!' })).status, 400);
    assert.equal((await transcribeCall(appWith(), { audio: WAV, language: 'xx' })).status, 400);
    assert.equal((await transcribeCall(appWith(), { audio: WAV, samplingRate: 3 })).status, 400);
  });

  it('no logged-in user gives 401', async () => {
    assert.equal((await transcribeCall(appWith(), { audio: WAV }, {})).status, 401);
  });

  it('B14: Bhashini down gives 502 "Please type instead", and the service stays up', async () => {
    const app = appWith({ transcribe: fake(boom) });
    const res = await transcribeCall(app, { audio: WAV });
    assert.equal(res.status, 502);
    assert.match(res.body.error.message, /Please type instead/);
    assert.equal((await request(app).get('/health')).status, 200);
  });

  it('B14 with the real client: no Bhashini keys gives 502, not a crash', async () => {
    const saved = [process.env.BHASHINI_USER_ID, process.env.BHASHINI_ULCA_API_KEY];
    delete process.env.BHASHINI_USER_ID;
    delete process.env.BHASHINI_ULCA_API_KEY;
    try {
      const res = await transcribeCall(createApp(), { audio: WAV });
      assert.equal(res.status, 502);
    } finally {
      if (saved[0] !== undefined) process.env.BHASHINI_USER_ID = saved[0];
      if (saved[1] !== undefined) process.env.BHASHINI_ULCA_API_KEY = saved[1];
    }
  });

  it('a recording over the 5 MB limit gives 413 in the usual error shape', async () => {
    const res = await transcribeCall(appWith(), { audio: 'A'.repeat(5.5 * 1024 * 1024) });
    assert.equal(res.status, 413);
    assert.match(res.body.error.message, /30 seconds/);
  });

  describe('the audio is never logged', () => {
    let logged;
    const originals = {};
    beforeEach(() => {
      logged = [];
      for (const k of ['log', 'error', 'warn', 'info']) {
        originals[k] = console[k];
        console[k] = (...args) => logged.push(args.join(' '));
      }
    });
    afterEach(() => { for (const k of Object.keys(originals)) console[k] = originals[k]; });

    it('not on success, not on failure', async () => {
      const secret = Buffer.from('SECRET-AUDIO-BYTES-1234567890').toString('base64');
      await transcribeCall(appWith(), { audio: secret });
      await transcribeCall(appWith({ transcribe: fake(boom) }), { audio: secret });
      await transcribeCall(appWith({ transcribe: fake(() => { throw new TypeError(secret); }) }), { audio: secret });
      assert.ok(!logged.some(line => line.includes(secret)), 'audio found in the logs');
    });
  });
});
