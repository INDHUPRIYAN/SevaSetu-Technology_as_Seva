// VoiceBridge: speak → understand → ask only what is missing (one question, at most three) → the card
// builds → read back. Stateless. Every check here runs with NO model (the rules alone) and, where it
// matters, again with a fake model, to prove the server decides and the model only suggests.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createApp } = require('../src/app');
const { findFlags } = require('../src/dignity');

const COORD = { 'x-user-id': '650000000000000000000004', 'x-user-role': 'coordinator' };
const VOL = { 'x-user-id': '650000000000000000000002', 'x-user-role': 'volunteer' };
const CONTEXT = {
  recentCards: [
    { _id: 'c1', title: 'English Reading Support', place: 'Government School, Kanchipuram', rhythm: { day: 'Saturday', start: '10:00', end: '12:00' }, weeks: 4 },
  ],
};
const COMPLETE = '12 students of class 6 to 8 want help reading English aloud at the Community Hall in Guduvanchery, '
  + 'every Saturday 10 am to 12, for 4 weeks. Volunteers should let them choose the story. A volunteer will learn to wait.';

let saved;
before(() => {
  saved = { LLM_API_KEY: process.env.LLM_API_KEY, GROQ_API_KEY: process.env.GROQ_API_KEY, LLM_MODEL: process.env.LLM_MODEL };
  delete process.env.LLM_API_KEY;
  delete process.env.GROQ_API_KEY;
});
after(() => { for (const [k, v] of Object.entries(saved)) if (v !== undefined) process.env[k] = v; });

const say = (app, body, headers = COORD) => request(app).post('/api/bridge/voicebridge').set(headers).send(body);
const coordinator = text => ({ role: 'coordinator', text });
const app = () => createApp();

// walk a conversation: each coordinator turn is sent with the turns and draft so far, like the browser does
async function walk(a, language, answers, context = CONTEXT) {
  const turns = [];
  let draft = null;
  let last = null;
  for (const text of answers) {
    turns.push(coordinator(text));
    const res = await say(a, { language, turns, draft, context });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    last = res.body.data;
    draft = last.draft;
    if (last.question) turns.push({ role: 'app', text: last.question.text, field: last.question.field, relatedCardId: last.relatedCardId || undefined });
  }
  return { last, turns, draft };
}

describe('VoiceBridge with no API key (the rules alone)', () => {
  it('one complete spoken sentence → no question, straight to the read-back', async () => {
    const { last } = await walk(app(), 'en', [COMPLETE]);
    assert.equal(last.question, null);
    assert.deepEqual(last.missing, []);
    assert.equal(last.source, 'rules');
    assert.equal(last.draft.rhythm.day, 'Saturday');
    assert.deepEqual([last.draft.rhythm.start, last.draft.rhythm.end], ['10:00', '12:00']);
    assert.equal(last.draft.weeks, 4);
    assert.equal(last.draft.groupSize, 12);
    assert.match(last.draft.place, /Community Hall/);
    assert.match(last.draft.serveUsWell, /choose the story/);
    assert.match(last.draft.youWillLearn, /learn to wait/);
    assert.match(last.readBack, /Saturday.*10:00.*12:00.*4 weeks/);
  });

  it('a vague sentence → exactly one question, in the selected language', async () => {
    const res = await say(app(), { language: 'ta', turns: [coordinator('பள்ளி குழந்தைகளுக்கு ஆங்கிலம் படிக்க உதவி வேண்டும்')], draft: null, context: CONTEXT });
    const d = res.body.data;
    assert.ok(d.question, 'a question was expected');
    assert.equal(d.question.field, 'place');
    assert.match(d.question.text, /[஀-௿]/, 'the question is in Tamil');
    assert.ok(d.missing.length > 1, 'more than one thing is missing, but only one question is asked');
    const hi = await say(app(), { language: 'hi', turns: [coordinator('बच्चों को गणित में मदद चाहिए')], draft: null, context: CONTEXT });
    assert.match(hi.body.data.question.text, /[ऀ-ॿ]/, 'the question is in Hindi');
  });

  it('more than 3 missing items → stops after 3 questions and leaves the rest for the form', async () => {
    const { last, turns } = await walk(app(), 'en', ['help with maths', 'Village library, Chengalpattu', 'Wednesday', '4 pm to 6 pm']);
    assert.equal(turns.filter(t => t.role === 'app').length, 3);
    assert.equal(last.question, null, 'no fourth question');
    assert.ok(last.missing.includes('weeks') && last.missing.includes('serveUsWell'), `still missing: ${last.missing}`);
    assert.equal(last.draft.place, 'Village library, Chengalpattu');
    assert.equal(last.draft.rhythm.day, 'Wednesday');
    assert.deepEqual([last.draft.rhythm.start, last.draft.rhythm.end], ['16:00', '18:00']);
  });

  it('"Change Wednesday to Thursday" → only the day changes', async () => {
    const { turns, draft } = await walk(app(), 'en', ['help with maths', 'Village library, Chengalpattu', 'Wednesday', '4 pm to 6 pm']);
    const before = JSON.parse(JSON.stringify(draft));
    turns.push(coordinator('Change Wednesday to Thursday'));
    const res = await say(app(), { language: 'en', turns, draft, context: CONTEXT });
    const after = res.body.data.draft;
    assert.equal(after.rhythm.day, 'Thursday');
    assert.deepEqual({ ...after, rhythm: { ...after.rhythm, day: before.rhythm.day } }, before, 'nothing but the day changed');
  });

  it('"Poor boy Ravi, family earns 5000" → flags set; the draft carries no name, income or "poor"', async () => {
    const res = await say(app(), { language: 'en', turns: [coordinator('Poor boy Ravi, family earns 5000, wants help reading on Sunday at the Village Library in Chengalpattu')], draft: null, context: CONTEXT });
    const d = res.body.data;
    const kinds = d.privacyFlags.map(f => f.kind);
    assert.ok(kinds.includes('name') && kinds.includes('money') && kinds.includes('word we avoid'), `flags: ${kinds}`);
    const card = JSON.stringify(d.draft);
    assert.doesNotMatch(card, /Ravi|5000|earns|\bpoor\b/i);
    assert.deepEqual(findFlags(card), []);
  });

  it('a related earlier card is asked about once; "yes" fills place and rhythm from it', async () => {
    const a = app();
    const first = await say(a, { language: 'en', turns: [coordinator('More help with reading at the Government School in Kanchipuram')], draft: null, context: CONTEXT });
    // the place was read from the words, so no related question is needed; make the words vaguer
    const vague = await say(a, { language: 'en', turns: [coordinator('The Kanchipuram government school children want help with maths')], draft: null, context: CONTEXT });
    const d = vague.body.data;
    assert.equal(d.question?.field, 'related', JSON.stringify(d.question));
    assert.equal(d.relatedCardId, 'c1');
    assert.match(d.question.text, /English Reading Support/);
    const turns = [coordinator('The Kanchipuram government school children want help with maths'), { role: 'app', field: 'related', text: d.question.text, relatedCardId: 'c1' }, coordinator('yes')];
    const after = await say(a, { language: 'en', turns, draft: d.draft, context: CONTEXT });
    assert.equal(after.body.data.draft.place, 'Government School, Kanchipuram');
    assert.equal(after.body.data.draft.rhythm.day, 'Saturday');
    assert.equal(after.body.data.draft.weeks, 4);
    assert.notEqual(after.body.data.question?.field, 'related', 'the related question is asked once');
    assert.ok(first.body.data.draft.place, 'a place said in words is kept');
  });

  it('a volunteer → 403; bad input → 400; works with no key (source "rules")', async () => {
    const a = app();
    assert.equal((await say(a, { language: 'en', turns: [coordinator('x')] }, VOL)).status, 403);
    assert.equal((await say(a, { language: 'fr', turns: [coordinator('x')] })).status, 400);
    assert.equal((await say(a, { language: 'en', turns: [] })).status, 400);
    assert.equal((await say(a, { language: 'en', turns: [{ role: 'app', text: '?' }] })).status, 400);
    const ok = await say(a, { language: 'en', turns: [coordinator('help with reading')] });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.data.source, 'rules');
  });

  it('capabilities says what is set up (nothing, here)', async () => {
    const res = await request(app()).get('/api/bridge/capabilities').set(COORD);
    assert.deepEqual(res.body.data, { llm: false, speech: false });
    assert.equal((await request(app()).get('/api/bridge/capabilities')).status, 401);
  });
});

describe('VoiceBridge with a model: the server still decides', () => {
  const withModel = impl => createApp({ callJSON: async job => impl(job), llmConfigured: () => true });
  const modelDraft = extra => ({
    title: 'Maths games', want: 'Children want help with maths.', serveUsWell: '', youWillLearn: '', groupSize: 0,
    interestTags: ['maths'], rhythm: { day: '', start: '', end: '' }, weeks: 0, place: '', ...extra,
  });

  it('the question is the fixed wording for the field the server chose, in the selected language; the model\'s read-back is used', async () => {
    const a = withModel(() => ({ draft: modelDraft(), question: 'What will they learn?', readBack: 'கணக்கு உதவி.' }));
    const res = await say(a, { language: 'ta', turns: [coordinator('குழந்தைகளுக்கு கணக்கு உதவி')], draft: null, context: CONTEXT });
    assert.equal(res.body.data.source, 'ai');
    assert.equal(res.body.data.question.field, 'place');
    assert.equal(res.body.data.question.text, 'இது எங்கே நடக்கும்? இடத்தின் பெயரைச் சொல்லுங்கள்.');   // never the model's drifting wording
    assert.equal(res.body.data.readBack, 'கணக்கு உதவி.');
  });

  it('a model answer with a name or money is cleaned; one that does not fit the schema is ignored', async () => {
    const dirty = withModel(() => ({ draft: modelDraft({ want: 'Ravi, a poor boy whose family earns 5000, wants maths help.' }), question: '', readBack: 'Ravi needs help.' }));
    const res = await say(dirty, { language: 'en', turns: [coordinator('maths help')], draft: null, context: CONTEXT });
    assert.doesNotMatch(JSON.stringify(res.body.data.draft), /Ravi|5000|poor/);
    assert.doesNotMatch(res.body.data.readBack, /Ravi/);
    const broken = withModel(() => { throw new Error('did not match the schema'); });
    const r2 = await say(broken, { language: 'en', turns: [coordinator('maths help')], draft: null, context: CONTEXT });
    assert.equal(r2.body.data.source, 'rules');
  });

  it('never asks a fourth question even if the model offers one', async () => {
    const a = withModel(() => ({ draft: modelDraft(), question: 'And what else?', readBack: 'x' }));
    const { last, turns } = await walk(a, 'en', ['help with maths', 'Village library', 'Wednesday', '4 pm to 6 pm']);
    assert.equal(turns.filter(t => t.role === 'app').length, 3);
    assert.equal(last.question, null);
  });
});
