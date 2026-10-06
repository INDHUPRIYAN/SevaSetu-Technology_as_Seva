// The AI jobs: dignity-check, listening-guide, suggest-update, find-teaching. The model is a fake here;
// with no key the real client is used, to prove every job falls back without AI.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createApp } = require('../src/app');
const { findFlags, ruleRewrite } = require('../src/dignity');
const { FALLBACK_QUESTIONS } = require('../src/routes/ai');
const { loadVerified, ruleMatch } = require('../src/teachings');

const COORD = { 'x-user-id': '650000000000000000000004', 'x-user-role': 'coordinator' };
const VOL = { 'x-user-id': '650000000000000000000002', 'x-user-role': 'volunteer' };
const RAVI = 'poor boy Ravi, income 5000';
const CARD = { title: 'English Reading Support', want: 'Twelve students of class 6 to 8 want to read English aloud.', place: 'Government School' };
const WISDOM = [
  { id: 'w05', theme: 'patience', text: 'Purity, patience, and perseverance overcome all obstacles.' },
  { id: 'w08', theme: 'work', text: 'Let us work on, doing as we go whatever happens to be our duty.' },
];

function fake(impl) {
  const calls = [];
  const fn = async (...args) => { calls.push(args); return impl(...args); };
  fn.calls = calls;
  return fn;
}
const never = () => new Promise(() => {});
const appWith = deps => createApp({ loadWisdom: () => WISDOM, ...deps });
const post = (app, path, body, headers = COORD) => request(app).post(`/api/bridge/${path}`).set(headers).send(body);

// No key in the environment: the real client throws at once, so every job must fall back
let saved;
before(() => {
  saved = { LLM_API_KEY: process.env.LLM_API_KEY, GROQ_API_KEY: process.env.GROQ_API_KEY };
  delete process.env.LLM_API_KEY;
  delete process.env.GROQ_API_KEY;
});
after(() => { for (const [k, v] of Object.entries(saved)) if (v !== undefined) process.env[k] = v; });

describe('every AI job works with no API key', () => {
  const app = () => createApp({ loadWisdom: () => WISDOM });

  it('dignity-check: rule flags and a rule rewrite', async () => {
    const res = await post(app(), 'dignity-check', { text: RAVI });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.source, 'rules');
    assert.ok(res.body.data.flags.length >= 3);
  });

  it('listening-guide: the 3 fixed questions', async () => {
    const res = await post(app(), 'listening-guide', CARD, VOL);
    assert.deepEqual(res.body.data, { questions: FALLBACK_QUESTIONS, source: 'fallback' });
  });

  it('suggest-update: the volunteer’s own words as the suggestion', async () => {
    const res = await post(app(), 'suggest-update', { needCard: CARD, heardText: 'They wanted to read to me, not be read to.' });
    assert.equal(res.body.data.source, 'fallback');
    assert.equal(res.body.data.suggestion, 'What a volunteer heard: They wanted to read to me, not be read to.');
  });

  it('find-teaching: the word match', async () => {
    const res = await post(app(), 'find-teaching', { situation: 'I had to wait a long time and got impatient.' }, VOL);
    assert.deepEqual(res.body.data, { id: 'w05', source: 'rules' });
  });
});

describe('POST /api/bridge/dignity-check', () => {
  it('flags "poor boy Ravi, income 5000": the name, the word, the money, each with a reason and its place', async () => {
    const res = await post(appWith({ callJSON: fake(() => { throw new Error('off'); }) }), 'dignity-check', { text: RAVI });
    const kinds = res.body.data.flags.map(f => f.kind);
    assert.ok(kinds.includes('name') && kinds.includes('money') && kinds.includes('word we avoid'), kinds.join());
    for (const f of res.body.data.flags) {
      assert.equal(RAVI.slice(f.start, f.end), f.match);
      assert.ok(f.why.length > 10);
    }
    assert.doesNotMatch(res.body.data.suggestedRewrite, /Ravi|poor|5000|income/i);
  });

  it('a clean text has no flags and no rewrite', async () => {
    const res = await post(appWith({ callJSON: fake(() => ({ flags: [], rewrite: '' })) }), 'dignity-check', { text: CARD.want });
    assert.deepEqual(res.body.data.flags, []);
    assert.equal(res.body.data.suggestedRewrite, null);
  });

  it('keeps a name only the AI found (in Tamil), and its clean rewrite', async () => {
    const tamil = 'ரவி என்ற மாணவன் ஆங்கிலம் படிக்க வேண்டும்';
    const callJSON = fake(() => ({ flags: [{ match: 'ரவி', kind: 'name', why: 'Names one person.' }], rewrite: 'மாணவர்கள் ஆங்கிலம் படிக்க விரும்புகிறார்கள்' }));
    const res = await post(appWith({ callJSON }), 'dignity-check', { text: tamil });
    assert.equal(res.body.data.flags.length, 1);
    assert.equal(res.body.data.flags[0].start, 0);
    assert.equal(res.body.data.source, 'ai');
    assert.equal(res.body.data.suggestedRewrite, 'மாணவர்கள் ஆங்கிலம் படிக்க விரும்புகிறார்கள்');
  });

  it('ignores an AI flag that is not in the text, and an AI rewrite that still breaks a rule', async () => {
    const callJSON = fake(() => ({ flags: [{ match: 'Kumar', kind: 'name', why: 'x' }], rewrite: 'A poor student wants help.' }));
    const res = await post(appWith({ callJSON }), 'dignity-check', { text: RAVI });
    assert.ok(!res.body.data.flags.some(f => f.match === 'Kumar'));
    assert.equal(res.body.data.source, 'rules');
    assert.equal(res.body.data.suggestedRewrite, ruleRewrite(RAVI));
  });

  it('a slow AI is cut off and the rules answer', async () => {
    const res = await post(createApp({ callJSON: never, draftTimeoutMs: 5, loadWisdom: () => WISDOM }), 'dignity-check', { text: RAVI });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.source, 'rules');
  });

  it('volunteers get 403, empty text 400', async () => {
    assert.equal((await post(appWith({}), 'dignity-check', { text: RAVI }, VOL)).status, 403);
    assert.equal((await post(appWith({}), 'dignity-check', { text: ' ' })).status, 400);
  });
});

describe('POST /api/bridge/listening-guide', () => {
  it('uses 3 good AI questions, labelled ai', async () => {
    const qs = ['What would you like us to know first?', 'What do the students enjoy reading?', 'How should a visitor behave in class?'];
    const res = await post(appWith({ callJSON: fake(() => ({ questions: qs })) }), 'listening-guide', CARD, VOL);
    assert.deepEqual(res.body.data, { questions: qs, source: 'ai' });
  });

  it('falls back when the AI asks fewer than 3 good questions (not questions, or breaking a rule)', async () => {
    const callJSON = fake(() => ({ questions: ['Tell me about the poor children.', 'What is their income?', 'Do they like it?'] }));
    const res = await post(appWith({ callJSON }), 'listening-guide', CARD, VOL);
    assert.deepEqual(res.body.data, { questions: FALLBACK_QUESTIONS, source: 'fallback' });
  });

  it('needs a user and a card', async () => {
    assert.equal((await post(appWith({}), 'listening-guide', CARD, {})).status, 401);
    assert.equal((await post(appWith({}), 'listening-guide', {}, VOL)).status, 400);
  });
});

describe('POST /api/bridge/suggest-update', () => {
  it('checks the heard text first: flagged words never reach the model', async () => {
    const callJSON = fake(() => ({ line: 'The students would like to read aloud to the volunteer first.' }));
    const heard = "Ravi, a poor boy, his father's income is Rs 5000, wants to read to me first.";
    const res = await post(appWith({ callJSON }), 'suggest-update', { needCard: CARD, heardText: heard });
    assert.doesNotMatch(callJSON.calls[0][0].user, /Ravi|poor|5000|income/i);
    assert.deepEqual(res.body.data, { suggestion: 'The students would like to read aloud to the volunteer first.', source: 'ai' });
  });

  it('the AI may say nothing should change (null)', async () => {
    const res = await post(appWith({ callJSON: fake(() => ({ line: '' })) }), 'suggest-update', { needCard: CARD, heardText: 'All as the card says.' });
    assert.deepEqual(res.body.data, { suggestion: null, source: 'ai' });
  });

  it('an AI line that breaks a rule is not used', async () => {
    const res = await post(appWith({ callJSON: fake(() => ({ line: 'The needy children want more.' })) }), 'suggest-update', { needCard: CARD, heardText: 'They want to read aloud.' });
    assert.equal(res.body.data.source, 'fallback');
    assert.doesNotMatch(res.body.data.suggestion, /needy/);
  });

  it('volunteers get 403, empty heard text 400', async () => {
    assert.equal((await post(appWith({}), 'suggest-update', { heardText: 'x' }, VOL)).status, 403);
    assert.equal((await post(appWith({}), 'suggest-update', { needCard: CARD })).status, 400);
  });
});

describe('POST /api/bridge/find-teaching', () => {
  it('returns the id the AI picked, when it is a verified id', async () => {
    const res = await post(appWith({ callJSON: fake(() => ({ id: 'w08' })) }), 'find-teaching', { situation: 'Nobody noticed what I did.' }, VOL);
    assert.deepEqual(res.body.data, { id: 'w08', source: 'ai' });
  });

  it('an id that is not verified wisdom is never returned', async () => {
    const res = await post(appWith({ callJSON: fake(() => ({ id: 'w99' })) }), 'find-teaching', { situation: 'I had to wait.' }, VOL);
    assert.ok(res.body.data.id === null || WISDOM.some(w => w.id === res.body.data.id));
    assert.notEqual(res.body.data.id, 'w99');
  });

  it('null when the AI finds nothing, or when no teaching is verified yet', async () => {
    const none = await post(appWith({ callJSON: fake(() => ({ id: '' })) }), 'find-teaching', { situation: 'I had to wait.' }, VOL);
    assert.equal(none.body.data.id, null);
    const empty = await post(createApp({ loadWisdom: () => [], callJSON: fake(() => ({ id: 'w05' })) }), 'find-teaching', { situation: 'I had to wait.' }, VOL);
    assert.deepEqual(empty.body.data, { id: null, source: 'rules' });
  });

  it('the model sees only verified teachings and the situation, and returns only an id', async () => {
    const callJSON = fake(() => ({ id: 'w05' }));
    await post(appWith({ callJSON }), 'find-teaching', { situation: 'I had to wait.' }, VOL);
    const sent = callJSON.calls[0][0];
    assert.match(sent.user, /w05: Purity/);
    assert.deepEqual(Object.keys(sent.schema.properties), ['id']);
  });

  it('needs a user and a situation', async () => {
    assert.equal((await post(appWith({}), 'find-teaching', { situation: 'x' }, {})).status, 401);
    assert.equal((await post(appWith({}), 'find-teaching', { situation: '' }, VOL)).status, 400);
  });
});

describe('rules and data', () => {
  it('the dignity rules leave ordinary need words alone', () => {
    for (const t of ['In case of rain we meet inside.', 'Twelve students of class 6 to 8 want help reading English aloud.', 'Saturday 10:30 to 12 at the school.'])
      assert.deepEqual(findFlags(t), [], t);
  });

  it('they catch money, caste, religion, health, age and the words we avoid', () => {
    const kinds = findFlags('A 10 year old Hindu girl, disabled, family income Rs 3000, a needy beneficiary case for the donor.').map(f => f.kind);
    for (const k of ['age', 'caste or religion', 'health', 'money', 'word we avoid']) assert.ok(kinds.includes(k), k);
  });

  it('the finder reads only verified items from seed/wisdom.json', () => {
    const all = require('../../../seed/wisdom.json');
    const verified = loadVerified();
    assert.deepEqual(verified.map(w => w.id), all.filter(w => w.verified === true).map(w => w.id));
    assert.equal(ruleMatch('anything at all', []), null);
  });
});
