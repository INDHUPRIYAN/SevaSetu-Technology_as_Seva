// services/bridge/src/server.js — no database, just listens
require('dotenv').config();
const { createApp } = require('./app');

createApp().listen(process.env.PORT || 4003, () => console.log('bridge up'));
