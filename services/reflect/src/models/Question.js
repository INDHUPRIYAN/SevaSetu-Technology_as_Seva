// questions — seeded, one per week, themes rotate every 5 weeks
const { Schema, model } = require('mongoose');

const questionSchema = new Schema({
  order: { type: Number, required: true, unique: true },     // 1 to 5
  theme: { type: String, required: true },
  text: { type: String, required: true },
  teaching: { type: String, required: true },
}, { versionKey: false });

module.exports = model('Question', questionSchema, 'questions');
