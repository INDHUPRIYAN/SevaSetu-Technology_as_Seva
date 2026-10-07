// services/gateway/src/server.js — no database, just listens
// Settings: this service's own .env (if any) first, then the root .env, where every token lives in one file.
// dotenv never overwrites a value already set, so the host's environment wins, then the service file, then the root.
const path = require('path');
require('dotenv').config({ quiet: true });
require('dotenv').config({ path: path.join(__dirname, '../../../.env'), quiet: true });
process.env.PORT ||= process.env.GATEWAY_PORT;
const { createApp } = require('./app');

createApp().listen(process.env.PORT || 8080, () => console.log('gateway up'));
