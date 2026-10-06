// services/core/src/server.js — connects to MongoDB, then listens
require('dotenv').config();
const mongoose = require('mongoose');
const { createApp } = require('./app');

mongoose.connect(process.env.MONGO_URI).then(() => {
  createApp().listen(process.env.PORT || 4001, () => console.log('core up'));
});
