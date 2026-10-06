// services/core/src/models — every collection in seva_core
// Rules: no field for a served person's name, age, income, caste, religion or photo.
// No field stores hours: progress is currentWeek of weeks.
const { Schema, model, models } = require('mongoose');
const { ObjectId } = Schema.Types;

const User = models.User || model('User', new Schema({
  name: { type: String, required: true },
  role: { type: String, enum: ['volunteer', 'coordinator'], required: true },
  city: String,
  interests: [String],
  orgId: { type: ObjectId, ref: 'Org' },             // coordinators only
}));

const Org = models.Org || model('Org', new Schema({
  name: { type: String, required: true },
  place: String,
  city: String,
  distanceKm: Number,
  verified: { type: Boolean, default: false },
}));

const Need = models.Need || model('Need', new Schema({
  orgId: { type: ObjectId, ref: 'Org', required: true },
  coordinatorId: { type: ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  want: String,                                      // What we want
  serveUsWell: String,                               // How to serve us well
  youWillLearn: String,                              // What you will learn
  groupSize: Number,
  interestTags: [String],
  rhythm: { day: String, start: String, end: String },
  weeks: { type: Number, default: 4 },
  place: String,
  status: { type: String, enum: ['open', 'filled', 'closed'], default: 'open' },
  // read back to the community, the community confirmed, and the coordinator consented to publish
  consent: { readBack: Boolean, coordinatorConsent: Boolean, agreedOn: String },
  // left by the volunteer who finished, for whoever serves here next
  handover: { type: { note: String, at: Date }, default: null },
}, { timestamps: true }));

const Visit = models.Visit || model('Visit', new Schema({
  needId: { type: ObjectId, ref: 'Need', required: true },
  volunteerId: { type: ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['requested', 'visited', 'agreed', 'declined'], default: 'requested' },
  heardText: String,
  volunteerYes: { type: Boolean, default: null },
  coordinatorYes: { type: Boolean, default: null },
}, { timestamps: true }).index({ needId: 1, volunteerId: 1 }, { unique: true }));

const sessionSchema = new Schema({
  week: Number,
  status: { type: String, enum: ['upcoming', 'served', 'gap', 'covered'], default: 'upcoming' },
  coveredBy: { type: ObjectId, ref: 'User', default: null },
  note: { type: String, default: null, maxlength: 300 },          // "where we stopped", for whoever covers
}, { _id: false });

const Commitment = models.Commitment || model('Commitment', new Schema({
  visitId: { type: ObjectId, ref: 'Visit', required: true, unique: true },
  needId: { type: ObjectId, ref: 'Need', required: true },
  volunteerId: { type: ObjectId, ref: 'User', required: true },
  sentence: String,                                  // "Why I am doing this", in her words
  weeks: { type: Number, default: 4 },
  currentWeek: { type: Number, default: 1 },
  sessions: [sessionSchema],
  invitation: { type: { text: String, sentAt: Date }, default: null },
  status: { type: String, enum: ['active', 'paused', 'finished'], default: 'active' },
  lastChoice: { type: String, default: null },
  pausedUntil: { type: String, default: null },                   // YYYY-MM-DD the volunteer plans to return
  handover: { type: { note: String, at: Date }, default: null },  // written when finishing
}, { timestamps: true }));

const Circle = models.Circle || model('Circle', new Schema({
  name: String,
  memberIds: [{ type: ObjectId, ref: 'User' }],
}));

module.exports = { User, Org, Need, Visit, Commitment, Circle };
