// services/core/src/server.js — connects to MongoDB, then listens
// Settings: this service's own .env (if any) first, then the root .env, where every token lives in one file.
// dotenv never overwrites a value already set, so the host's environment wins, then the service file, then the root.
const path = require('path');
require('dotenv').config({ quiet: true });
require('dotenv').config({ path: path.join(__dirname, '../../../.env'), quiet: true });
process.env.MONGO_URI ||= process.env.CORE_MONGO_URI;
process.env.PORT ||= process.env.CORE_PORT;
const mongoose = require('mongoose');
const { createApp } = require('./app');

mongoose.connect(process.env.MONGO_URI).then(() => {
  createApp().listen(process.env.PORT || 4001, () => console.log('core up'));
});
