// voice notes — PRIVATE to the user, like the diary. One short recording per week, kept as the bytes the
// browser recorded. Nothing is derived from it: no transcript, no model, no speech service, ever. It is
// read back only by the person who recorded it.
const { Schema, model } = require('mongoose');

const MAX_BYTES = 2 * 1024 * 1024;                           // about 60 s of compressed speech

const voiceNoteSchema = new Schema({
  userId: { type: String, required: true },                  // only ever from x-user-id
  commitmentId: { type: String, required: true },            // plain string, never looked up in core
  week: { type: Number, required: true, min: 1 },
  mimeType: { type: String, required: true, maxlength: 80 },
  audio: { type: Buffer, required: true },
  seconds: { type: Number, default: null },
}, { timestamps: true, versionKey: false });

voiceNoteSchema.index({ userId: 1, commitmentId: 1, week: 1 }, { unique: true });

module.exports = model('VoiceNote', voiceNoteSchema, 'voicenotes');
module.exports.MAX_BYTES = MAX_BYTES;
