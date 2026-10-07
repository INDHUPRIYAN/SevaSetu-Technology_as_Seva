// api/index.js — the whole backend as ONE Vercel function: the same gateway + core + reflect + bridge apps
// that mono.js runs, in one process. vercel.json sends every path here. The MongoDB connection is opened once
// per warm instance and reused; nothing is seeded here (seed Atlas once with `npm run seed:mono`).
const mongoose = require('mongoose');
const { createApp: createGateway } = require('../services/gateway/src/app');
const { createApp: createCore } = require('../services/core/src/app');
const { createApp: createReflect } = require('../services/reflect/src/app');
const { createApp: createBridge } = require('../services/bridge/src/app');

const app = createGateway({ local: { core: createCore(), reflect: createReflect(), bridge: createBridge() } });

let connecting = null;
function connect() {
  if (mongoose.connection.readyState === 1) return Promise.resolve();
  connecting ||= mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 }).catch(e => { connecting = null; throw e; });
  return connecting;
}

module.exports = async (req, res) => {
  try {
    await connect();
  } catch (e) {
    console.error('api: database connection failed:', e.name, e.message.slice(0, 300));   // never the URI
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: { message: 'The database is not reachable just now. Try again in a moment.', kind: e.name, ipAllowList: /whitelist|IP that isn't|not allowed/i.test(e.message) } }));
  }
  return app(req, res);
};
