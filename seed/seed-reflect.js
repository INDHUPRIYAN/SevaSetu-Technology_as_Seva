// Run: npm run seed   (or MONGO_URI="...seva_reflect" node seed/seed-reflect.js)
// Clears its four collections first, so it is safe to run again and again.
const ids = require('./ids');
const Question = require('../services/reflect/src/models/Question');
const Entry = require('../services/reflect/src/models/Entry');
const Wisdom = require('../services/reflect/src/models/Wisdom');
const Why = require('../services/reflect/src/models/Why');
const Moment = require('../services/reflect/src/models/Moment');
const { QUESTIONS, WHYS, MOMENTS, WISDOM, SEEDED_ENTRY } = require('./reflect-data');

const mongoose = Question.base;                  // the same mongoose the models were built with

// Seeds the database mongoose is connected to. Used by the CLI below, the tests and the dev stack.
async function seedReflect() {
  await Promise.all([Question, Entry, Wisdom, Why, Moment].map(m => m.deleteMany({})));
  await Promise.all([Question, Entry, Wisdom, Why, Moment].map(m => m.init()));     // unique indexes exist

  const questions = await Question.insertMany(QUESTIONS);
  // one by one, so the _id order (which "today" uses) is the order written in the data file
  for (const { theme, text, source, volume, page } of WISDOM) await Wisdom.create({ theme, text, source, volume, page });
  await Why.insertMany(WHYS);
  await Moment.insertMany(MOMENTS);

  const weekOne = questions.find(q => q.order === 1);
  await Entry.create({
    userId: ids.users.seededVolunteer,
    commitmentId: ids.commitments.seeded,
    questionId: weekOne._id,
    ...SEEDED_ENTRY,
  });

  return {
    questions: questions.length,
    wisdom: WISDOM.length,
    whys: WHYS.length,
    moments: MOMENTS.length,
    entries: 1,
    uncheckedQuotes: WISDOM.filter(w => !w.checked).length,
  };
}

if (require.main === module) {
  // uses MONGO_URI from the command line, else from services/reflect/.env
  require('dotenv').config({ path: require('path').join(__dirname, '../services/reflect/.env'), quiet: true });
  (async () => {
    if (!process.env.MONGO_URI) throw new Error('Set MONGO_URI (it should end in /seva_reflect)');
    await mongoose.connect(process.env.MONGO_URI);
    const counts = await seedReflect();
    console.log(`seeded seva_reflect: ${counts.questions} questions, ${counts.wisdom} wisdom, `
      + `${counts.whys} whys, ${counts.moments} moments, ${counts.entries} diary entry`);
    if (counts.uncheckedQuotes)
      console.warn(`WARNING: ${counts.uncheckedQuotes} quote(s) still need a person to check them in the `
        + 'Complete Works (seed/wisdom-quotes.js, checked: false).');
    await mongoose.disconnect();
  })().catch(async err => {
    console.error('seed failed:', err.message);
    await mongoose.disconnect();
    process.exit(1);
  });
}

module.exports = { seedReflect, ids };
