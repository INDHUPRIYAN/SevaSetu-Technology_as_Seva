// services/reflect/src/server.js — connects to MongoDB, then listens
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const { createApp } = require('./app');

mongoose.connect(process.env.MONGO_URI).then(() => {
  createApp().listen(process.env.PORT || 4002, () => console.log('reflect up'));
}).catch(err => {
  console.error('reflect: could not connect to MongoDB:', err.message);
  process.exit(1);
});
