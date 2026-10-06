// entries — PRIVATE to the user. Only their own words: no score, no sentiment, nothing derived.
const { Schema, model } = require('mongoose');

const entrySchema = new Schema({
  userId: { type: String, required: true },                  // only ever from x-user-id
  commitmentId: { type: String, required: true },            // plain string, never looked up in core
  week: { type: Number, required: true, min: 1 },
  questionId: { type: Schema.Types.ObjectId, ref: 'Question', required: true },
  text: { type: String, required: true, trim: true, maxlength: 4000 },
  hardDay: { type: Boolean, default: false },
}, { timestamps: true, versionKey: false });

// one entry per week: writing again in the same week updates it
entrySchema.index({ userId: 1, commitmentId: 1, week: 1 }, { unique: true });

module.exports = model('Entry', entrySchema, 'entries');
