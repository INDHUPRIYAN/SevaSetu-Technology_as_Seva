// services/gateway/src/server.js — no database, just listens
require('dotenv').config({ quiet: true });
const { createApp } = require('./app');

createApp().listen(process.env.PORT || 8080, () => console.log('gateway up'));
