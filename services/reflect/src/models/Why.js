// whys — seeded. The reason behind each rule of the app, in three clearly separate parts:
// a verified teaching (quote + source, or null when no honest quote fits), our interpretation of
// it, and the product decision it led to. Interpretation and decision are our words, not quotes.
const { Schema, model } = require('mongoose');

const whySchema = new Schema({
  ruleKey: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  quote: { type: String, default: null },
  source: { type: String, default: null },
  interpretation: { type: String, required: true },
  decision: { type: String, required: true },
}, { versionKey: false });

module.exports = model('Why', whySchema, 'whys');
