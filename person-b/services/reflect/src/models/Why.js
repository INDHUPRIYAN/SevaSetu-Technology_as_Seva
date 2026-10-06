// whys — seeded. The teaching behind each rule of the app ("Why no leaderboard?").
const { Schema, model } = require('mongoose');

const whySchema = new Schema({
  ruleKey: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  teaching: { type: String, required: true },
}, { versionKey: false });

module.exports = model('Why', whySchema, 'whys');
