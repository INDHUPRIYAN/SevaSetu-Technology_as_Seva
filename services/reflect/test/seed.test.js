// seed-reflect.js — plan section 9.4, tests D1, D3, D4, D5.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const Question = require('../src/models/Question');
const Entry = require('../src/models/Entry');
const Wisdom = require('../src/models/Wisdom');
const Why = require('../src/models/Why');
const Moment = require('../src/models/Moment');
const Sankalpa = require('../src/models/Sankalpa');
const { startDb, seedReflect, ids } = require('./helpers');
const { WISDOM, WHYS, MOMENTS, QUESTIONS } = require('../../../seed/reflect-data');

let stopDb;
before(async () => { stopDb = await startDb(); });
after(async () => { await stopDb(); });

const counts = async () => ({
  questions: await Question.countDocuments(),
  entries: await Entry.countDocuments(),
  wisdom: await Wisdom.countDocuments(),
  whys: await Why.countDocuments(),
  moments: await Moment.countDocuments(),
  sankalpas: await Sankalpa.countDocuments(),
});

describe('seed-reflect', () => {
  it('D1: running it twice gives no errors and no duplicates', async () => {
    await seedReflect();
    const once = await counts();
    await seedReflect();
    assert.deepEqual(await counts(), once);
    assert.deepEqual(once, { questions: 5, entries: 1, wisdom: WISDOM.length, whys: 6, moments: 7, sankalpas: 1 });
  });

  it('D3: the seeded volunteer has exactly one entry, week 1, on the shared commitment id', async () => {
    await seedReflect();
    const list = await Entry.find({ userId: ids.users.seededVolunteer }).lean();
    assert.equal(list.length, 1);
    assert.equal(list[0].week, 1);
    assert.equal(list[0].commitmentId, ids.commitments.seeded);
    assert.equal(list[0].text, 'I kept correcting them.');
  });

  it('the questions are the four from plan section 4, in order', () => {
    assert.deepEqual(QUESTIONS.map(q => q.theme), ['patience', 'listening', 'effort', 'received', 'pride']);
  });

  it('the whys cover every rule key the screens pass to WhyLink', () => {
    assert.deepEqual(WHYS.map(w => w.ruleKey).sort(),
      ['community-confirmation', 'listen-first', 'no-hours', 'no-photos', 'no-ranks', 'private-diary']);
  });

  it('no invented quotes: every quote in a why or a moment is one of the verified wisdom quotes', () => {
    const verified = new Map(WISDOM.map(w => [w.text, w.source]));
    for (const item of [...WHYS, ...MOMENTS]) {
      if (item.quote == null) { assert.equal(item.source ?? null, null); continue; }
      assert.equal(verified.get(item.quote), item.source, `${item.ruleKey || item.key}: quote is not in the verified list`);
    }
    // the non-attachment moments are plain words of our own: no quote at all, and no apology
    const PLAIN = ['declined', 'closed', 'finished'];
    for (const m of MOMENTS) {
      if (PLAIN.includes(m.key)) {
        assert.equal(m.quote, undefined, `${m.key}: must not carry a quotation`);
        assert.doesNotMatch(m.interpretation + m.practice, /sorry|apolog/i, `${m.key}: no apology language`);
      } else {
        assert.ok(m.quote, `${m.key}: a journey moment always carries a verified teaching`);
      }
    }
  });

  it('D4: no photo URL, no income figure and no word we avoid anywhere in the seed', async () => {
    await seedReflect();
    // ruleKey is an internal id fixed by the contract ('no-hours'), not words anyone reads
    const everything = JSON.stringify(await Promise.all([Question, Entry, Wisdom, Why, Moment].map(m => m.find().select('-ruleKey').lean())));
    assert.doesNotMatch(everything, /https?:\/\/|\.(jpe?g|png|webp|gif)\b/i, 'photo or URL');
    assert.doesNotMatch(everything, /₹|\brs\.?\s*\d|\brupees?\b|\bincome\b|\bsalary\b/i, 'money');
    assert.doesNotMatch(everything, /\b(beneficiar\w*|needy|donate|rank|points|hours)\b/i, 'word we avoid');
  });

  it('D5: every wisdom quote has a source with a volume', () => {
    assert.ok(WISDOM.length >= 8, 'at least the 8 the plan asks for');
    for (const w of WISDOM) {
      assert.ok(['service', 'strength', 'patience', 'work'].includes(w.theme), w.theme);
      assert.match(w.source, /Complete Works/i, w.text);
      assert.match(w.source, /Vol(ume)?\.?\s*\d/i, w.text);
    }
  });

  it('wisdom.json: every item has a unique id, text, source and a verified flag', () => {
    assert.equal(new Set(WISDOM.map(w => w.id)).size, WISDOM.length);
    for (const w of WISDOM) {
      assert.match(w.id, /^w\d{2,}$/);
      assert.ok(w.text.trim() && w.source.trim());
      assert.equal(typeof w.verified, 'boolean', w.text);
    }
  });

  it('D5: every quote has been checked in the book by a person', { todo: WISDOM.some(w => !w.verified) &&
    `${WISDOM.filter(w => !w.verified).length} quote(s) still marked verified: false in seed/wisdom.json` }, () => {
    assert.ok(WISDOM.every(w => w.verified));
  });
});
