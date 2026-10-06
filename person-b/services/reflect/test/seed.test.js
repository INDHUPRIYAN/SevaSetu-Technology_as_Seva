// seed-reflect.js — plan section 9.4, tests D1, D3, D4, D5.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const Question = require('../src/models/Question');
const Entry = require('../src/models/Entry');
const Wisdom = require('../src/models/Wisdom');
const Why = require('../src/models/Why');
const { startDb, seedReflect, ids } = require('./helpers');
const { WISDOM, WHYS, QUESTIONS } = require('../../../seed/reflect-data');

let stopDb;
before(async () => { stopDb = await startDb(); });
after(async () => { await stopDb(); });

const counts = async () => ({
  questions: await Question.countDocuments(),
  entries: await Entry.countDocuments(),
  wisdom: await Wisdom.countDocuments(),
  whys: await Why.countDocuments(),
});

describe('seed-reflect', () => {
  it('D1: running it twice gives no errors and no duplicates', async () => {
    await seedReflect();
    const once = await counts();
    await seedReflect();
    assert.deepEqual(await counts(), once);
    assert.deepEqual(once, { questions: 4, entries: 1, wisdom: 8, whys: 4 });
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
    assert.deepEqual(QUESTIONS.map(q => q.theme), ['patience', 'listening', 'effort', 'received']);
  });

  it('the whys are the four rule keys A passes to WhyLink', () => {
    assert.deepEqual(WHYS.map(w => w.ruleKey).sort(), ['listen-first', 'no-hours', 'no-photos', 'no-ranks']);
  });

  it('D4: no photo URL, no income figure and no word we avoid anywhere in the seed', async () => {
    await seedReflect();
    const everything = JSON.stringify(await Promise.all([Question, Entry, Wisdom, Why].map(m => m.find().lean())));
    assert.doesNotMatch(everything, /https?:\/\/|\.(jpe?g|png|webp|gif)\b/i, 'photo or URL');
    assert.doesNotMatch(everything, /₹|\brs\.?\s*\d|\brupees?\b|\bincome\b|\bsalary\b/i, 'money');
    assert.doesNotMatch(everything, /\b(beneficiar\w*|needy|donate|rank|points|hours)\b/i, 'word we avoid');
  });

  it('D5: every wisdom quote has a source with a volume', () => {
    assert.equal(WISDOM.length, 8);
    for (const w of WISDOM) {
      assert.ok(['service', 'strength', 'patience', 'work'].includes(w.theme), w.theme);
      assert.match(w.source, /Complete Works/i, w.text);
      assert.match(w.source, /Vol(ume)?\.?\s*\d/i, w.text);
    }
  });

  it('D5: every quote has been checked in the book by a person', { todo: WISDOM.some(w => !w.checked) &&
    `${WISDOM.filter(w => !w.checked).length} quote(s) still marked checked: false in seed/wisdom-quotes.js` }, () => {
    assert.ok(WISDOM.every(w => w.checked));
  });
});
