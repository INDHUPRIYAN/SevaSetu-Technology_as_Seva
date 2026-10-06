// Endpoints 25–27 (Wisdom and "Why?") — plan section 9.1, tests R15–R18, plus /health.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createApp } = require('../src/app');
const { dayOfYear } = require('../src/dayOfYear');
const { startDb, seedReflect, VOL, COORD } = require('./helpers');
const { WISDOM } = require('../../../seed/reflect-data');

let stopDb;
before(async () => { stopDb = await startDb(); await seedReflect(); });
after(async () => { await stopDb(); });

const at = iso => createApp({ now: () => new Date(iso) });

describe('health', () => {
  it('GET /health answers without a user', async () => {
    const res = await request(createApp()).get('/health');
    assert.deepEqual(res.body, { ok: true, service: 'reflect' });
  });

  it('unknown paths answer 404 in the usual error shape', async () => {
    const res = await request(createApp()).get('/api/reflect/nothing').set(VOL);
    assert.equal(res.status, 404);
    assert.ok(res.body.error.message);
  });
});

describe('25. GET /api/wisdom/today', () => {
  it('R15: the same quote both times, with a source', async () => {
    const app = createApp();
    const a = await request(app).get('/api/wisdom/today').set(VOL);
    const b = await request(app).get('/api/wisdom/today').set(COORD);
    assert.equal(a.status, 200);
    assert.deepEqual(a.body.data, b.body.data);
    assert.ok(a.body.data.text);
    assert.ok(a.body.data.source.trim());
  });

  it('same quote all day in India time, a different one the next day', async () => {
    const morning = await request(at('2026-10-06T00:40:00+05:30')).get('/api/wisdom/today').set(VOL);
    const night = await request(at('2026-10-06T23:50:00+05:30')).get('/api/wisdom/today').set(VOL);
    const nextDay = await request(at('2026-10-07T09:00:00+05:30')).get('/api/wisdom/today').set(VOL);
    assert.equal(morning.body.data._id, night.body.data._id);
    assert.notEqual(morning.body.data._id, nextDay.body.data._id);
  });

  it('picks dayOfYear % count, in the order of the seed file', async () => {
    const day = dayOfYear(new Date('2026-10-06T12:00:00+05:30'), 'Asia/Kolkata');
    const res = await request(at('2026-10-06T12:00:00+05:30')).get('/api/wisdom/today').set(VOL);
    assert.equal(res.body.data.text, WISDOM[day % WISDOM.length].text);
  });
});

describe('dayOfYear', () => {
  it('counts from 1 on 1 January and handles leap years', () => {
    assert.equal(dayOfYear(new Date('2026-01-01T12:00:00Z'), 'UTC'), 1);
    assert.equal(dayOfYear(new Date('2026-12-31T12:00:00Z'), 'UTC'), 365);
    assert.equal(dayOfYear(new Date('2028-12-31T12:00:00Z'), 'UTC'), 366);
  });

  it('uses the given time zone, not the server clock', () => {
    // 20:00 UTC on 1 Jan is already 2 Jan in India
    assert.equal(dayOfYear(new Date('2026-01-01T20:00:00Z'), 'Asia/Kolkata'), 2);
    assert.equal(dayOfYear(new Date('2026-01-01T20:00:00Z'), 'UTC'), 1);
  });
});

describe('26. GET /api/wisdom', () => {
  it('R16: all 8 items, every one with a non-empty source', async () => {
    const res = await request(createApp()).get('/api/wisdom').set(VOL);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 8);
    for (const w of res.body.data) {
      assert.ok(w.text.trim());
      assert.ok(w.source.trim(), `missing source: ${w.text}`);
    }
  });

  it('R16: ?theme=patience returns fewer, all patience', async () => {
    const res = await request(createApp()).get('/api/wisdom').query({ theme: 'patience' }).set(VOL);
    assert.ok(res.body.data.length > 0 && res.body.data.length < 8);
    assert.ok(res.body.data.every(w => w.theme === 'patience'));
  });

  it('each of the four chips (Service, Strength, Patience, Work) has teachings; case does not matter', async () => {
    for (const theme of ['Service', 'STRENGTH', 'patience', ' work ']) {
      const res = await request(createApp()).get('/api/wisdom').query({ theme }).set(VOL);
      assert.ok(res.body.data.length >= 1, theme);
    }
  });

  it('an unknown theme gives an empty list, not an error', async () => {
    const res = await request(createApp()).get('/api/wisdom').query({ theme: 'nothing' }).set(VOL);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, []);
  });
});

describe('27. GET /api/wisdom/why/:ruleKey', () => {
  it('R17: all 4 rules return a title and a teaching', async () => {
    for (const rule of ['no-ranks', 'no-photos', 'no-hours', 'listen-first']) {
      const res = await request(createApp()).get(`/api/wisdom/why/${rule}`).set(VOL);
      assert.equal(res.status, 200, rule);
      assert.ok(res.body.data.title.trim());
      assert.ok(res.body.data.teaching.trim());
    }
  });

  it('R18: an unknown rule gives 404', async () => {
    const res = await request(createApp()).get('/api/wisdom/why/abc').set(VOL);
    assert.equal(res.status, 404);
    assert.ok(res.body.error.message);
  });
});
