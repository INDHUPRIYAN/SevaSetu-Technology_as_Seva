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
  location: { type: { lat: Number, lng: Number }, default: null },   // for Resource Connect distances between organisations
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
  // the need ended (school shut, organisation moved); set by the coordinator
  closed: { type: { reason: { type: String, maxlength: 300 }, at: Date, _id: false }, default: null },
  // the coordinator's own words, in the language they were said, kept beside the English card
  original: {
    type: { text: { type: String, maxlength: 5000 }, language: { type: String, enum: ['en', 'ta', 'hi'] } },
    default: null,
  },
  // "Updated after listening": lines the coordinator approved after a volunteer's visit
  updates: { type: [{ text: { type: String, maxlength: 300 }, at: Date, visitId: ObjectId, _id: false }], default: [] },
}, { timestamps: true }));

const Visit = models.Visit || model('Visit', new Schema({
  needId: { type: ObjectId, ref: 'Need', required: true },
  volunteerId: { type: ObjectId, ref: 'User', required: true },
  // One Visit ramp: requested → visited (she wrote what she heard) → invited | declined. The community
  // answers first, always; the volunteer's yes is the commitment itself.
  status: { type: String, enum: ['requested', 'visited', 'invited', 'declined'], default: 'requested' },
  heardText: String,
  // "They would like you to come back": relayed by the coordinator after the visit
  invitation: { type: { text: { type: String, maxlength: 300 }, sentAt: Date }, default: null },
  // "Updated after listening": what the coordinator decided about a suggested line for the need card
  update: { type: { status: { type: String, enum: ['approved', 'rejected'] }, text: String, at: Date }, default: null },
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
  // "What the group wanted to say": one line the coordinator relays at finish, in the language it was said,
  // about the group and never a named person; the coordinator ran the Dignity Check and approved it
  communityWords: {
    type: { text: { type: String, maxlength: 300 }, language: { type: String, enum: ['en', 'ta', 'hi'] }, at: Date, _id: false },
    default: null,
  },
  // Community Check-in every 4 weeks: three questions asked in person, entered by the coordinator
  checkIns: {
    type: [{
      week: Number,
      helping: { type: String, maxlength: 500 },        // Is this helping?
      change: { type: String, maxlength: 500 },         // Should anything change?
      ownNow: { type: String, maxlength: 500 },         // What can the group now do on their own?
      ended: { type: Boolean, default: false },         // the community chose to end the arrangement
      at: Date,
      _id: false,
    }],
    default: [],
  },
}, { timestamps: true }));

const Circle = models.Circle || model('Circle', new Schema({
  name: String,
  memberIds: [{ type: ObjectId, ref: 'User' }],
}));

// Resource Connect: one organisation offers things, another asks for them. Things only, never people.
const Resource = models.Resource || model('Resource', new Schema({
  orgId: { type: ObjectId, ref: 'Org', required: true },
  kind: { type: String, enum: ['offer', 'request'], required: true },
  category: { type: String, enum: ['equipment', 'space', 'skill', 'transport', 'materials'], required: true },
  mode: { type: String, enum: ['lend', 'share', 'give'], required: true },
  type: { type: String, required: true, lowercase: true, trim: true, maxlength: 60 },   // "tablets"
  quantity: { type: Number, required: true, min: 1, max: 10000 },
  availableFrom: { type: String, default: null },        // YYYY-MM-DD: when an offer is ready / a request is needed
  note: { type: String, default: '', maxlength: 300 },
  status: { type: String, enum: ['open', 'matched', 'handed-over'], default: 'open' },
  matchedWith: { type: ObjectId, ref: 'Resource', default: null },
  handedOverAt: { type: Date, default: null },
  // asked after the handover: is it in use?
  inUse: { type: { answer: { type: String, enum: ['yes', 'not-yet', 'no'] }, at: Date }, default: null },
}, { timestamps: true }));

module.exports = { User, Org, Need, Visit, Commitment, Circle, Resource };
