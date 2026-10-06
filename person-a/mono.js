// mono.js — the whole backend in ONE process, on ONE port.
// Fallback if the separate services misbehave, and a way to deploy as a single Render service.
//   MONGO_URI=... JWT_SECRET=... node mono.js
// Core uses the default mongoose connection (MONGO_URI). When reflect joins, give it its own
// connection to seva_reflect (mongoose.createConnection), so the two databases stay separate.
const path = require('path');
const platformPort = process.env.PORT;               // set by the host (Render); read before .env adds core's PORT
require('dotenv').config({ path: path.join(__dirname, 'services/core/.env'), quiet: true });
const mongoose = require('mongoose');
const { createApp: createGateway } = require('./services/gateway/src/app');
const { createApp: createCore } = require('./services/core/src/app');

// Person B's services join here after integration (see ../docs/INTEGRATION.md)
function optional(file) {
  try { return require(file).createApp(); } catch (e) { return null; }
}

mongoose.connect(process.env.MONGO_URI).then(() => {
  const app = createGateway({
    local: {
      core: createCore(),
      reflect: optional('./services/reflect/src/app'),
      bridge: optional('./services/bridge/src/app'),
    },
  });
  const port = platformPort || 8080;
  app.listen(port, () => console.log(`mono up on ${port}`));
});
