// sankalpa — one private line on why the volunteer is doing this seva. Written once when she commits,
// sealed, and shown again only to her, at Then and Now. Like the diary: only her own words.
const { Schema, model } = require('mongoose');

const sankalpaSchema = new Schema({
  userId: { type: String, required: true },                  // only ever from x-user-id
  commitmentId: { type: String, required: true },            // plain string, never looked up in core
  text: { type: String, required: true, trim: true, maxlength: 300 },
}, { timestamps: { createdAt: 'sealedAt', updatedAt: false }, versionKey: false });

// one sankalpa per commitment; once sealed it is not rewritten
sankalpaSchema.index({ userId: 1, commitmentId: 1 }, { unique: true });

module.exports = model('Sankalpa', sankalpaSchema, 'sankalpas');
