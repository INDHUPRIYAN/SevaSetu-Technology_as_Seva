// Run: npm run seed   (or MONGO_URI="...seva_reflect" node seed/seed-reflect.js)
// Clears its four collections first, so it is safe to run again and again.
const ids = require('./ids');
const Question = require('../services/reflect/src/models/Question');
const Entry = require('../services/reflect/src/models/Entry');
const Wisdom = require('../services/reflect/src/models/Wisdom');
const Why = require('../services/reflect/src/models/Why');
const Moment = require('../services/reflect/src/models/Moment');
const Sankalpa = require('../services/reflect/src/models/Sankalpa');
const Received = require('../services/reflect/src/models/Received');
const { QUESTIONS, WHYS, MOMENTS, WISDOM, SEEDED_ENTRY, SEEDED_SANKALPA } = require('./reflect-data');

const mongoose = Question.base;                  // the same mongoose the models were built with

// Seeds the database mongoose is connected to. Used by the CLI below, the tests and the dev stack.
async function seedReflect() {
  await Promise.all([Question, Entry, Wisdom, Why, Moment, Sankalpa, Received].map(m => m.deleteMany({})));
  await Promise.all([Question, Entry, Wisdom, Why, Moment, Sankalpa, Received].map(m => m.init()));     // unique indexes exist

  const questions = await Question.insertMany(QUESTIONS);
  // one by one, so the _id order (which "today" uses) is the order written in the data file
  for (const { id, theme, text, source, volume, page, verified } of WISDOM) await Wisdom.create({ key: id, theme, text, source, volume, page, verified });
  await Why.insertMany(WHYS);
  await Moment.insertMany(MOMENTS);

  const weekOne = questions.find(q => q.order === 1);
  await Entry.create({
    userId: ids.users.seededVolunteer,
    commitmentId: ids.commitments.seeded,
    questionId: weekOne._id,
    ...SEEDED_ENTRY,
  });
  await Sankalpa.create({ userId: ids.users.seededVolunteer, commitmentId: ids.commitments.seeded, text: SEEDED_SANKALPA });

  return {
    questions: questions.length,
    wisdom: WISDOM.length,
    whys: WHYS.length,
    moments: MOMENTS.length,
    entries: 1,
    sankalpas: 1,
    unverifiedQuotes: WISDOM.filter(w => !w.verified).length,
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
    if (counts.unverifiedQuotes)
      console.warn(`NOTE: ${counts.unverifiedQuotes} of ${counts.wisdom} quote(s) are hidden until a person checks them `
        + 'in the Complete Works and sets verified: true in seed/wisdom.json.');
    await mongoose.disconnect();
  })().catch(async err => {
    console.error('seed failed:', err.message);
    await mongoose.disconnect();
    process.exit(1);
  });
}

module.exports = { seedReflect, ids };
