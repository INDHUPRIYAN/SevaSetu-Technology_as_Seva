// Shared test setup: a real MongoDB in memory, seeded with the real seed script.
// Set MONGOMS_SYSTEM_BINARY to a local mongod to skip the one-time binary download.
const { MongoMemoryServer } = require('mongodb-memory-server');
const Question = require('../src/models/Question');
const { seedReflect, ids } = require('../../../seed/seed-reflect');

const mongoose = Question.base;

async function startDb() {
  const server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri('seva_reflect_test'));
  return async function stopDb() {
    await mongoose.disconnect();
    await server.stop();
  };
}

// The headers the gateway sets after checking a token
const as = (id, role = 'volunteer') => ({ 'x-user-id': id, 'x-user-role': role });

const VOL = as(ids.users.seededVolunteer);
const VOL2 = as(ids.users.circleMember);
const NEW_VOL = as(ids.users.newVolunteer);
const COORD = as(ids.users.coordinator, 'coordinator');
const X = ids.commitments.seeded;

// No field anywhere may grade the diary (test R19)
const FORBIDDEN_KEYS = ['score', 'rating', 'points', 'streak', 'sentiment', 'rank', 'badge', 'hours'];
function forbiddenKeysIn(value, found = []) {
  if (Array.isArray(value)) value.forEach(v => forbiddenKeysIn(v, found));
  else if (value && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.includes(k.toLowerCase())) found.push(k);
      forbiddenKeysIn(v, found);
    }
  return found;
}

module.exports = { startDb, seedReflect, as, VOL, VOL2, NEW_VOL, COORD, X, ids, forbiddenKeysIn };
