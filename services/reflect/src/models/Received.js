// received — "What did they give you?", answered once when a seva finishes, before any handover is
// written. Private like the diary and the Sankalpa: only her own words, read back only by her.
const { Schema, model } = require('mongoose');

const receivedSchema = new Schema({
  userId: { type: String, required: true },                  // only ever from x-user-id
  commitmentId: { type: String, required: true },            // plain string, never looked up in core
  text: { type: String, required: true, trim: true, maxlength: 1000 },
}, { timestamps: { createdAt: 'writtenAt', updatedAt: false }, versionKey: false });

receivedSchema.index({ userId: 1, commitmentId: 1 }, { unique: true });

module.exports = model('Received', receivedSchema, 'received');
