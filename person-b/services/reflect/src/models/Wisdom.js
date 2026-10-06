// wisdom — seeded, human-checked quotes only. Every quote carries its source.
const { Schema, model } = require('mongoose');

const wisdomSchema = new Schema({
  theme: { type: String, required: true, lowercase: true, trim: true },
  text: { type: String, required: true },
  source: { type: String, required: true, trim: true },
}, { versionKey: false });

module.exports = model('Wisdom', wisdomSchema, 'wisdom');
