// seed/seed-core.js — clears and fills seva_core. Safe to run again and again.
//   npm run seed                       (uses MONGO_URI from services/core/.env)
//   MONGO_URI="...seva_core" npm run seed
// All names are invented. No served person's name, age, income or photo anywhere.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../services/core/.env'), quiet: true });
const mongoose = require('mongoose');
const ids = require('./ids');
const { User, Org, Need, Visit, Commitment, Circle, Resource } = require('../services/core/src/models');

const oid = id => new mongoose.Types.ObjectId(id);
const today = new Date().toISOString().slice(0, 10);
const daysAgo = n => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

const users = [
  { _id: ids.users.newVolunteer, name: 'Meera Krishnan', role: 'volunteer', city: 'Chennai', interests: ['teaching', 'reading'] },
  { _id: ids.users.seededVolunteer, name: 'Arjun Raman', role: 'volunteer', city: 'Chennai', interests: ['teaching'] },
  { _id: ids.users.circleMember, name: 'Kavya Suresh', role: 'volunteer', city: 'Chennai', interests: ['reading', 'art'] },
  { _id: ids.users.coordinator, name: 'Lakshmi Narayanan', role: 'coordinator', city: 'Kanchipuram', orgId: ids.orgs.govtSchool },
  { _id: ids.users.otherVolunteer, name: 'Rahul Menon', role: 'volunteer', city: 'Chennai', interests: ['listening'] },
];

const orgs = [
  { _id: ids.orgs.govtSchool, name: 'Government School', place: 'Government School, Kanchipuram', city: 'Kanchipuram', distanceKm: 3, verified: true },
  { _id: ids.orgs.org2, name: 'Anbu Community Library', place: 'Anbu Community Library, Tambaram', city: 'Chennai', distanceKm: 5, verified: true },
  { _id: ids.orgs.org3, name: 'Sunrise Elders Home', place: 'Sunrise Elders Home, Guduvanchery', city: 'Chennai', distanceKm: 8, verified: true },
  { _id: ids.orgs.college, name: 'Sri Ramana Arts College', place: 'Sri Ramana Arts College, Kanchipuram', city: 'Kanchipuram', distanceKm: 6, verified: true },
];

const card = (id, orgId, fields) => ({
  _id: id,
  orgId,
  coordinatorId: ids.users.coordinator,
  weeks: 4,
  status: 'open',
  consent: { readBack: true, agreedOn: today },
  ...fields,
});

const needs = [
  card(ids.needs.englishReading, ids.orgs.govtSchool, {
    title: 'English Reading Support',
    want: 'Twelve students of class 6 to 8 want help reading English aloud, with confidence.',
    serveUsWell: 'No photos, please. The students may take time to open up, so let them finish their sentences and listen more than you correct.',
    youWillLearn: 'The students can teach you a local game — and how a government school classroom really works.',
    groupSize: 12,
    interestTags: ['teaching', 'reading'],
    rhythm: { day: 'Saturday', start: '10:00', end: '12:00' },
    place: 'Government School, Kanchipuram',
    status: 'filled',
  }),
  card(ids.needs.need2, ids.orgs.govtSchool, {
    title: 'Spoken English Circle',
    want: 'Students of class 9 want to practise speaking English in small groups.',
    serveUsWell: 'Ask questions and wait for answers. Mistakes are welcome here.',
    youWillLearn: 'How to make space for a quiet voice.',
    groupSize: 10,
    interestTags: ['teaching', 'conversation'],
    rhythm: { day: 'Saturday', start: '09:00', end: '10:30' },
    place: 'Government School, Kanchipuram',
  }),
  card(ids.needs.need3, ids.orgs.org2, {
    title: 'Reading Corner Helpers',
    want: 'Children who visit the library on Saturdays want someone to read stories with them.',
    serveUsWell: 'Let the children pick the book. Read slowly, and let them read to you too.',
    youWillLearn: 'Which stories children in your own city love.',
    groupSize: 15,
    interestTags: ['reading', 'teaching'],
    rhythm: { day: 'Saturday', start: '16:00', end: '17:30' },
    place: 'Anbu Community Library, Tambaram',
  }),
  card(ids.needs.need4, ids.orgs.org2, {
    title: 'Number Games Club',
    want: 'Children of class 3 to 5 want to play number games that make maths less scary.',
    serveUsWell: 'Play along. Nobody is graded and nobody loses.',
    youWillLearn: 'How children reason when nobody is testing them.',
    groupSize: 8,
    interestTags: ['teaching', 'games'],
    rhythm: { day: 'Saturday', start: '11:00', end: '12:00' },
    place: 'Anbu Community Library, Tambaram',
  }),
  card(ids.needs.need5, ids.orgs.org3, {
    title: 'Morning Conversations',
    want: 'Elders at the home want company for a slow morning conversation and a walk in the garden.',
    serveUsWell: 'Come to listen, not to entertain. Ask about their lives and let them lead.',
    youWillLearn: 'The history of your city, told by people who lived it.',
    groupSize: 6,
    interestTags: ['listening', 'conversation'],
    rhythm: { day: 'Saturday', start: '08:00', end: '09:30' },
    place: 'Sunrise Elders Home, Guduvanchery',
  }),
  card(ids.needs.need6, ids.orgs.org3, {
    title: 'Garden Mornings',
    want: 'Elders want help keeping the vegetable garden they planted together.',
    serveUsWell: 'They know the garden. Ask before you dig.',
    youWillLearn: 'How to grow greens in a Chennai summer.',
    groupSize: 5,
    interestTags: ['gardening'],
    rhythm: { day: 'Sunday', start: '07:30', end: '09:00' },
    place: 'Sunrise Elders Home, Guduvanchery',
  }),
  card(ids.needs.need7, ids.orgs.org3, {
    title: 'Art Afternoons',
    want: 'Elders want a friendly hand with drawing and colouring on Saturday afternoons.',
    serveUsWell: 'Bring paper and patience. Everyone\'s drawing is good.',
    youWillLearn: 'That art has no age.',
    groupSize: 6,
    interestTags: ['art', 'teaching'],
    rhythm: { day: 'Saturday', start: '15:00', end: '16:30' },
    place: 'Sunrise Elders Home, Guduvanchery',
  }),
];

const visits = [{
  _id: ids.visits.seeded,
  needId: ids.needs.englishReading,
  volunteerId: ids.users.seededVolunteer,
  status: 'agreed',
  heardText: 'The children wanted to read to me, not be read to.',
  volunteerYes: true,
  coordinatorYes: true,
  createdAt: daysAgo(21),
}];

const commitments = [{
  _id: ids.commitments.seeded,
  visitId: ids.visits.seeded,
  needId: ids.needs.englishReading,
  volunteerId: ids.users.seededVolunteer,
  sentence: 'I will come every Saturday from 10:00 AM to 12:00 PM for 4 weeks.',
  weeks: 4,
  currentWeek: 2,
  sessions: [
    { week: 1, status: 'served' },
    { week: 2, status: 'served' },
    { week: 3, status: 'upcoming' },
    { week: 4, status: 'upcoming' },
  ],
  invitation: null,
  status: 'active',
  createdAt: daysAgo(14),
}];

// Resource Connect: things other organisations can offer (demo: the school asks for 10 tablets)
const inDays = n => new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const resources = [
  { _id: ids.resources.collegeTablets, orgId: ids.orgs.college, kind: 'offer', type: 'tablets', quantity: 10, availableFrom: inDays(7), note: 'Used for one year, charged and reset. Cases included.' },
  { _id: ids.resources.libraryBooks, orgId: ids.orgs.org2, kind: 'offer', type: 'storybooks', quantity: 30, availableFrom: inDays(3), note: 'Tamil and English, for ages 8 to 12.' },
  { _id: ids.resources.eldersChairs, orgId: ids.orgs.org3, kind: 'request', type: 'folding chairs', quantity: 12, availableFrom: inDays(14), note: 'For the garden mornings.' },
];

const circles = [{
  _id: ids.circles.main,
  name: 'Saturday Circle',
  memberIds: [ids.users.newVolunteer, ids.users.seededVolunteer, ids.users.circleMember],
}];

async function seed() {
  if (!process.env.MONGO_URI) throw new Error('Set MONGO_URI (services/core/.env or the command line)');
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db.databaseName;

  const plan = [[User, users], [Org, orgs], [Need, needs], [Visit, visits], [Commitment, commitments], [Circle, circles], [Resource, resources]];
  for (const [Model, docs] of plan) {
    await Model.deleteMany({});
    await Model.insertMany(docs.map(d => ({ ...d, _id: oid(d._id) })));
    await Model.syncIndexes();
    console.log(`${db}.${Model.collection.name}: ${docs.length}`);
  }
  await mongoose.disconnect();
}

seed().catch(e => { console.error(e.message); process.exit(1); });
