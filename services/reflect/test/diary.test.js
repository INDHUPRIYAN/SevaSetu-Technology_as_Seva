// Endpoints 21–24 (Seva Diary) — plan section 9.1, tests R2–R14 and R19, against a real MongoDB.
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createApp } = require('../src/app');
const { startDb, seedReflect, VOL, VOL2, NEW_VOL, COORD, X, ids, forbiddenKeysIn } = require('./helpers');

const app = createApp();
const WEEK2 = 'I waited, and he finished the sentence himself.';

let stopDb;
before(async () => { stopDb = await startDb(); });
after(async () => { await stopDb(); });
beforeEach(async () => { await seedReflect(); });

const entries = (headers, commitmentId = X) =>
  request(app).get('/api/reflect/entries').query({ commitmentId }).set(headers);

async function questionFor(week, headers = VOL) {
  const res = await request(app).get('/api/reflect/question').query({ commitmentId: X, week }).set(headers);
  return res.body.data;
}

function saveWeek2(headers = VOL, body = {}) {
  return questionFor(2, headers).then(q =>
    request(app).post('/api/reflect/entries').set(headers)
      .send({ commitmentId: X, week: 2, questionId: q._id, text: WEEK2, hardDay: false, ...body }));
}

describe('privacy (R10, R11, R12) — a diary never leaks', () => {
  it('R10: another volunteer sees an empty list for the same commitment', async () => {
    const res = await entries(VOL2);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, []);
  });

  it('R11: a coordinator sees an empty list', async () => {
    const res = await entries(COORD);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, []);
  });

  it('R12: a userId in the body is ignored; the entry is saved under the caller', async () => {
    const res = await saveWeek2(VOL2, { userId: ids.users.seededVolunteer, text: 'Written by the other volunteer' });
    assert.equal(res.status, 201);

    const vol = await entries(VOL);
    assert.equal(vol.body.data.length, 1, "VOL's list is unchanged");
    assert.equal(vol.body.data[0].week, 1);

    const vol2 = await entries(VOL2);
    assert.equal(vol2.body.data.length, 1);
    assert.equal(vol2.body.data[0].text, 'Written by the other volunteer');
  });

  it('Then and Now is private too', async () => {
    for (const headers of [VOL2, COORD]) {
      const res = await request(app).get('/api/reflect/then-and-now').query({ commitmentId: X }).set(headers);
      assert.deepEqual(res.body.data, { first: null, latest: null });
    }
  });

  it('responses never carry the owner id of an entry', async () => {
    const res = await entries(VOL);
    assert.equal(res.body.data[0].userId, undefined);
  });

  it('R2: a call without a user is refused with 401 (no owner filter means no query at all)', async () => {
    for (const path of ['/api/reflect/entries', '/api/reflect/then-and-now', '/api/reflect/question']) {
      const res = await request(app).get(path).query({ commitmentId: X, week: 1 });
      assert.equal(res.status, 401, path);
      assert.equal(res.body.error.message, 'Please log in');
    }
    const post = await request(app).post('/api/reflect/entries').send({ commitmentId: X, week: 2, text: 'x' });
    assert.equal(post.status, 401);
  });
});

describe('21. GET /api/reflect/question', () => {
  it('R3: week 1 is the patience question with its teaching line', async () => {
    const q = await questionFor(1);
    assert.equal(q.theme, 'patience');
    assert.equal(q.text, 'When did you have to wait today?');
    assert.equal(q.teaching, 'Patience and perseverance');
    assert.ok(q._id);
  });

  it('R4: weeks 1–5 give 5 different questions; week 6 is week 1 again; week 5 is the humility check', async () => {
    const qs = [];
    for (const week of [1, 2, 3, 4, 5, 6]) qs.push(await questionFor(week));
    assert.equal(new Set(qs.slice(0, 5).map(q => q.text)).size, 5);
    assert.equal(qs[5].text, qs[0].text);
    assert.deepEqual(qs.slice(0, 5).map(q => q.theme), ['patience', 'listening', 'effort', 'received', 'pride']);
    assert.equal(qs[4].text, 'Was there a moment this week I felt I knew better than them?');
  });

  it('R5: no week, or a week that is not a whole number from 1, gives 400', async () => {
    for (const week of [undefined, '', '0', '-1', 'abc', '1.5']) {
      const res = await request(app).get('/api/reflect/question').query({ commitmentId: X, week }).set(VOL);
      assert.equal(res.status, 400, `week=${week}`);
      assert.ok(res.body.error.message);
    }
  });
});

describe('22–23. saving and listing entries', () => {
  it('R6: the seeded volunteer has exactly 1 entry, week 1, with its question', async () => {
    const res = await entries(VOL);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 1);
    const [e] = res.body.data;
    assert.equal(e.week, 1);
    assert.equal(e.text, 'I kept correcting them.');
    assert.equal(e.question.text, 'When did you have to wait today?');
  });

  it('R7: saving week 2 gives 201 and the list is in week order', async () => {
    const res = await saveWeek2();
    assert.equal(res.status, 201);
    assert.equal(res.body.data.week, 2);
    assert.equal(res.body.data.text, WEEK2);
    assert.equal(res.body.data.question.theme, 'listening');

    const list = await entries(VOL);
    assert.deepEqual(list.body.data.map(e => e.week), [1, 2]);
  });

  it('R8: saving the same week again updates it — no duplicates', async () => {
    await saveWeek2();
    const again = await saveWeek2(VOL, { text: 'Second try at week two.', hardDay: true });
    assert.equal(again.status, 200);

    const list = await entries(VOL);
    assert.equal(list.body.data.length, 2);
    assert.equal(list.body.data[1].text, 'Second try at week two.');
    assert.equal(list.body.data[1].hardDay, true);
  });

  it('two saves of the same week at the same moment still make one entry', async () => {
    await Promise.all([saveWeek2(), saveWeek2(VOL, { text: 'At the same time' })]);
    const list = await entries(VOL);
    assert.equal(list.body.data.length, 2);
  });

  it('R9: empty or blank text gives 400', async () => {
    for (const text of ['', '   ', undefined, 42]) {
      const res = await saveWeek2(VOL, { text });
      assert.equal(res.status, 400, JSON.stringify(text));
    }
    assert.equal((await entries(VOL)).body.data.length, 1);
  });

  it('missing commitmentId or week gives 400; very long text gives 400', async () => {
    const send = body => request(app).post('/api/reflect/entries').set(VOL).send(body);
    assert.equal((await send({ week: 2, text: 'x' })).status, 400);
    assert.equal((await send({ commitmentId: X, text: 'x' })).status, 400);
    assert.equal((await send({ commitmentId: X, week: 0, text: 'x' })).status, 400);
    assert.equal((await send({ commitmentId: X, week: 2, text: 'x'.repeat(4001) })).status, 400);
    assert.equal((await request(app).get('/api/reflect/entries').set(VOL)).status, 400);
    assert.equal((await request(app).get('/api/reflect/then-and-now').set(VOL)).status, 400);
  });

  it('the server picks the question by week, whatever questionId the body says', async () => {
    const week1 = await questionFor(1);
    const res = await saveWeek2(VOL, { questionId: week1._id });
    assert.equal(res.body.data.question.theme, 'listening');
  });

  it('text is trimmed and hardDay is only true when sent as true', async () => {
    const res = await saveWeek2(VOL, { text: '  A quiet day.  ', hardDay: 'yes' });
    assert.equal(res.body.data.text, 'A quiet day.');
    assert.equal(res.body.data.hardDay, false);
  });

  it('entries of one commitment do not show under another', async () => {
    const res = await entries(VOL, '650000000000000000000099');
    assert.deepEqual(res.body.data, []);
  });

  it('broken JSON gives a 400 in the usual error shape', async () => {
    const res = await request(app).post('/api/reflect/entries').set(VOL)
      .set('Content-Type', 'application/json').send('{"text":');
    assert.equal(res.status, 400);
    assert.ok(res.body.error.message);
  });
});

describe('24. GET /api/reflect/then-and-now', () => {
  const thenAndNow = (headers, commitmentId = X) =>
    request(app).get('/api/reflect/then-and-now').query({ commitmentId }).set(headers);

  it('with one entry: first is week 1, latest is null', async () => {
    const res = await thenAndNow(VOL);
    assert.equal(res.body.data.first.week, 1);
    assert.equal(res.body.data.latest, null);
  });

  it('R13: first = week 1 text, latest = week 2 text, each with its question', async () => {
    await saveWeek2();
    const { first, latest } = (await thenAndNow(VOL)).body.data;
    assert.equal(first.text, 'I kept correcting them.');
    assert.equal(first.question.text, 'When did you have to wait today?');
    assert.equal(latest.text, WEEK2);
    assert.equal(latest.question.text, 'What did someone tell you that surprised you?');
  });

  it('latest is the newest week, not the second one', async () => {
    await saveWeek2();
    const q4 = await questionFor(4);
    await request(app).post('/api/reflect/entries').set(VOL)
      .send({ commitmentId: X, week: 4, questionId: q4._id, text: 'Their laughter.' });
    const { first, latest } = (await thenAndNow(VOL)).body.data;
    assert.equal(first.week, 1);
    assert.equal(latest.week, 4);
  });

  it('R14: a commitment with no entries gives { first: null, latest: null } and 200', async () => {
    const res = await thenAndNow(NEW_VOL, '650000000000000000000042');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, { first: null, latest: null });
  });
});

describe('R19: nothing grades the diary', () => {
  it('no score, rating, points, streak or sentiment in any diary response', async () => {
    await saveWeek2();
    const bodies = [
      (await request(app).get('/api/reflect/question').query({ week: 1 }).set(VOL)).body,
      (await entries(VOL)).body,
      (await request(app).get('/api/reflect/then-and-now').query({ commitmentId: X }).set(VOL)).body,
      (await saveWeek2()).body,
    ];
    assert.deepEqual(forbiddenKeysIn(bodies), []);
  });
});

describe('24b–c. the sealed Sankalpa', () => {
  const sankalpa = (headers, commitmentId = X) =>
    request(app).get('/api/reflect/sankalpa').query({ commitmentId }).set(headers);
  const seal = (headers, body) => request(app).post('/api/reflect/sankalpa').set(headers).send(body);
  const NEW_C = '650000000000000000000099';

  it('the seeded volunteer reads back his own sealed line', async () => {
    const res = await sankalpa(VOL);
    assert.equal(res.status, 200);
    assert.match(res.body.data.text, /find their words/);
    assert.ok(res.body.data.sealedAt);
  });

  it('nobody else can read it: another volunteer and the coordinator get null', async () => {
    for (const headers of [VOL2, COORD]) assert.equal((await sankalpa(headers)).body.data, null);
  });

  it('sealing works once; a second write is refused with 409 and the first line stays', async () => {
    assert.equal((await seal(NEW_VOL, { commitmentId: NEW_C, text: 'To learn to listen.' })).status, 201);
    assert.equal((await seal(NEW_VOL, { commitmentId: NEW_C, text: 'Something else' })).status, 409);
    assert.equal((await sankalpa(NEW_VOL, NEW_C)).body.data.text, 'To learn to listen.');
  });

  it('a userId in the body is ignored; it is sealed under the caller', async () => {
    await seal(VOL2, { commitmentId: NEW_C, userId: ids.users.newVolunteer, text: 'Mine, not hers.' });
    assert.equal((await sankalpa(NEW_VOL, NEW_C)).body.data, null);
    assert.equal((await sankalpa(VOL2, NEW_C)).body.data.text, 'Mine, not hers.');
  });

  it('empty text, missing commitmentId or more than one line of text gives 400', async () => {
    assert.equal((await seal(NEW_VOL, { commitmentId: NEW_C, text: '  ' })).status, 400);
    assert.equal((await seal(NEW_VOL, { text: 'x' })).status, 400);
    assert.equal((await seal(NEW_VOL, { commitmentId: NEW_C, text: 'x'.repeat(301) })).status, 400);
  });
});

describe('24f. GET /api/reflect/my-seva — across commitments, owner only', () => {
  const mySeva = headers => request(app).get('/api/reflect/my-seva').set(headers);
  const OTHER_C = '650000000000000000000098';

  it('the owner sees the first entry ever beside the latest, across commitments, and every Sankalpa in order', async () => {
    await saveWeek2();                                                     // a later entry on the seeded commitment
    const q = await questionFor(1);
    await request(app).post('/api/reflect/entries').set(VOL)
      .send({ commitmentId: OTHER_C, week: 1, questionId: q._id, text: 'A new place, the same waiting.', hardDay: false });
    await request(app).post('/api/reflect/sankalpa').set(VOL).send({ commitmentId: OTHER_C, text: 'To arrive without a plan.' });
    const res = await mySeva(VOL);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.first.text, 'I kept correcting them.');
    assert.equal(res.body.data.latest.text, 'A new place, the same waiting.');
    assert.deepEqual(res.body.data.sankalpas.map(x => x.commitmentId), [X, OTHER_C]);
    assert.match(res.body.data.sankalpas[0].text, /find their words/);
    assert.deepEqual(forbiddenKeysIn(res.body), []);
  });

  it('returns nothing for another user or a coordinator (a faked x-user-id is stripped by the gateway: api-test X21)', async () => {
    for (const headers of [VOL2, NEW_VOL, COORD]) {
      const res = await mySeva(headers);
      assert.equal(res.status, 200);
      assert.equal(res.body.data.first, null);
      assert.equal(res.body.data.latest, null);
      assert.deepEqual(res.body.data.sankalpas, []);
    }
  });
});

describe('24g–h. the private voice note: bytes in, the same bytes out, only for the owner; nothing derived', () => {
  const WAV = Buffer.from('RIFF....WAVEfmt ' + 'x'.repeat(64)).toString('base64');
  const put = (headers, body) => request(app).post('/api/reflect/voice').set(headers).send({ commitmentId: X, week: 2, mimeType: 'audio/webm', audioBase64: WAV, seconds: 7, ...body });
  const get = (headers, week) => request(app).get('/api/reflect/voice').query({ commitmentId: X, ...(week ? { week } : {}) }).set(headers);

  it('the owner records, lists and plays back exactly what was sent; recording again replaces it', async () => {
    assert.equal((await put(VOL)).status, 201);
    assert.equal((await put(VOL)).status, 200);                          // same week: replaced
    const list = await get(VOL);
    assert.deepEqual(list.body.data.map(n => n.week), [2]);
    assert.equal(list.body.data[0].audioBase64, undefined, 'the list carries no audio');
    const one = await get(VOL, 2);
    assert.equal(one.body.data.audioBase64, WAV);
    assert.equal(one.body.data.mimeType, 'audio/webm');
    assert.deepEqual(Object.keys(one.body.data).sort(), ['audioBase64', 'createdAt', 'mimeType', 'seconds', 'week'], 'no transcript, text or score');
  });

  it('another volunteer, or a coordinator, sees nothing; a faked userId in the body is ignored', async () => {
    await put(VOL, { userId: ids.users.circleMember });
    assert.deepEqual((await get(VOL2)).body.data, []);
    assert.equal((await get(VOL2, 2)).body.data, null);
    assert.deepEqual((await get(COORD)).body.data, []);
    assert.equal((await get(VOL, 2)).body.data?.audioBase64, WAV);
  });

  it('bad input is refused: no type, not base64, empty, too big; the owner can remove a note', async () => {
    assert.equal((await put(VOL, { mimeType: 'text/plain' })).status, 400);
    assert.equal((await put(VOL, { audioBase64: 'not base64!' })).status, 400);
    assert.equal((await put(VOL, { audioBase64: '' })).status, 400);
    const big = Buffer.alloc(2 * 1024 * 1024 + 1).toString('base64');
    assert.equal((await put(VOL, { audioBase64: big })).status, 413);
    await put(VOL);
    assert.equal((await request(app).delete('/api/reflect/voice').query({ commitmentId: X, week: 2 }).set(VOL2)).status, 200);
    assert.equal((await get(VOL, 2)).body.data?.audioBase64, WAV, 'another user cannot remove it');
    await request(app).delete('/api/reflect/voice').query({ commitmentId: X, week: 2 }).set(VOL);
    assert.equal((await get(VOL, 2)).body.data, null);
  });
});
