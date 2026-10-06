// wisdom — seeded, human-checked quotes only. Every quote carries its source.
const { Schema, model } = require('mongoose');

const wisdomSchema = new Schema({
  theme: { type: String, required: true, lowercase: true, trim: true },
  text: { type: String, required: true },
  source: { type: String, required: true, trim: true },     // "Complete Works, Vol. N, <section>, <piece>"
  volume: { type: Number, min: 1, max: 9 },
  page: { type: Number, default: null },                       // only when someone has read it in print
}, { versionKey: false });

module.exports = model('Wisdom', wisdomSchema, 'wisdom');
