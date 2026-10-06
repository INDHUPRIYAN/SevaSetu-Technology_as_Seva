// wisdom — seeded quotes, each with its source. Only `verified` ones ever leave the service.
const { Schema, model } = require('mongoose');

const wisdomSchema = new Schema({
  key: { type: String, required: true, unique: true },          // the item's id in seed/wisdom.json ("w01")
  theme: { type: String, required: true, lowercase: true, trim: true },
  text: { type: String, required: true },
  source: { type: String, required: true, trim: true },     // "Complete Works, Vol. N, <section>, <piece>"
  volume: { type: Number, min: 1, max: 9 },
  page: { type: Number, default: null },                       // only when someone has read it in print
  verified: { type: Boolean, default: false },                 // checked in print; only these are ever shown
}, { versionKey: false });

module.exports = model('Wisdom', wisdomSchema, 'wisdom');
