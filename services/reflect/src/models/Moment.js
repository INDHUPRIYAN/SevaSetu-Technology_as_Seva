// moments — seeded. A teaching shown in context (before a listening visit, after a hard day, …),
// in three separate parts: the verified teaching, our interpretation, and one practical action.
const { Schema, model } = require('mongoose');

const momentSchema = new Schema({
  key: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  quote: { type: String, required: true },
  source: { type: String, required: true },
  interpretation: { type: String, required: true },
  practice: { type: String, required: true },
}, { versionKey: false });

module.exports = model('Moment', momentSchema, 'moments');
