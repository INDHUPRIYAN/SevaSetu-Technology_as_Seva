// mono.js — the whole backend in ONE process, on ONE port: gateway, core, reflect and bridge.
// Fallback if the separate services misbehave, and a way to deploy as a single Render service.
//   MONGO_URI=... JWT_SECRET=... node mono.js
// All four share one MongoDB connection (MONGO_URI), so core's and reflect's collections live in
// one database here. Their collection names do not overlap, and the diary stays private in code:
// every entries query is filtered by the caller's own id.
const path = require('path');
const platformPort = process.env.PORT;               // set by the host (Render); read before .env adds core's PORT
const env = file => require('dotenv').config({ path: path.join(__dirname, file), quiet: true });
env('services/core/.env');
env('services/bridge/.env');                         // per-service files, if present
env('.env');                                         // the root .env: every token in one file
process.env.MONGO_URI ||= process.env.CORE_MONGO_URI;
const mongoose = require('mongoose');
const { createApp: createGateway } = require('./services/gateway/src/app');
const { createApp: createCore } = require('./services/core/src/app');
const { createApp: createReflect } = require('./services/reflect/src/app');
const { createApp: createBridge } = require('./services/bridge/src/app');

// SEED_ON_START=true: the first boot of a fresh database fills the demo data (core and reflect), once.
// A database that already has users is left alone, so a redeploy never wipes anything.
async function seedIfEmpty() {
  if (process.env.SEED_ON_START !== 'true') return;
  const { User } = require('./services/core/src/models');
  if (await User.countDocuments()) return;
  console.log('mono: empty database, seeding the demo data');
  await require('./seed/seed-core').seedCore();
  await require('./seed/seed-reflect').seedReflect();
  console.log('mono: seeded');
}

mongoose.connect(process.env.MONGO_URI).then(seedIfEmpty).then(() => {
  const app = createGateway({
    local: { core: createCore(), reflect: createReflect(), bridge: createBridge() },
  });
  const port = platformPort || 8080;
  app.listen(port, () => console.log(`mono up on ${port}`));
});
