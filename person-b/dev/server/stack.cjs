// One command for Person B's whole back end, for local work and the browser tests:
//   MongoDB (in memory and seeded, unless MONGO_URI is set) → reflect :4002, bridge :4003, mock gateway :8090
// NO_PROVIDERS=1 drops the Groq/Bhashini keys so the tests always get the fallback draft.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../services/bridge/.env'), quiet: true });

if (process.env.NO_PROVIDERS) {
  for (const k of ['GROQ_API_KEY', 'BHASHINI_USER_ID', 'BHASHINI_ULCA_API_KEY']) delete process.env[k];
}

const Question = require('../../services/reflect/src/models/Question');
const { createApp: createReflect } = require('../../services/reflect/src/app');
const { createApp: createBridge } = require('../../services/bridge/src/app');
const { seedReflect } = require('../../seed/seed-reflect');
const { createMockGateway } = require('./mock-gateway.cjs');

const mongoose = Question.base;
const PORTS = {
  reflect: Number(process.env.REFLECT_PORT) || 4002,
  bridge: Number(process.env.BRIDGE_PORT) || 4003,
  gateway: Number(process.env.GATEWAY_PORT) || 8090,
};

const listen = (app, port) => new Promise((resolve, reject) => {
  const server = app.listen(port, () => resolve(server));
  server.on('error', reject);
});

(async () => {
  let memory = null;
  let uri = process.env.MONGO_URI;
  if (!uri) {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    memory = await MongoMemoryServer.create();
    uri = memory.getUri('seva_reflect');
  }
  await mongoose.connect(uri);
  if (memory || process.env.SEED) await seedReflect();

  const reflectUrl = `http://localhost:${PORTS.reflect}`;
  const bridgeUrl = `http://localhost:${PORTS.bridge}`;
  const servers = await Promise.all([
    listen(createReflect(), PORTS.reflect),
    listen(createBridge(), PORTS.bridge),
    listen(createMockGateway({ reflectUrl, bridgeUrl, onReset: memory ? seedReflect : null }), PORTS.gateway),
  ]);
  console.log(`person-b stack up: gateway http://localhost:${PORTS.gateway}  reflect ${reflectUrl}  bridge ${bridgeUrl}`
    + `  (${memory ? 'in-memory MongoDB, seeded' : 'MongoDB from MONGO_URI'})`);

  let stopping = false;
  async function stop() {
    if (stopping) return;
    stopping = true;
    servers.forEach(s => s.close());
    await mongoose.disconnect();
    if (memory) await memory.stop();
    process.exit(0);
  }
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
})().catch(err => {
  console.error('person-b stack failed:', err.message);
  process.exit(1);
});
