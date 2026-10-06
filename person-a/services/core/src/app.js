// services/core/src/app.js  — builds the app, does NOT listen
const express = require('express');
const cors = require('cors');

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());                       // services parse JSON (the gateway does not)

  app.get('/health', (req, res) => res.json({ ok: true, service: 'core' }));

  // routes go here, mounted at the full path (the gateway forwards paths unchanged)
  // app.use('/api/auth', require('./routes/auth'));
  // app.use('/api/needs', require('./routes/needs'));

  // one error handler for the whole service
  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ error: { message: err.message } });
  });
  return app;
}
module.exports = { createApp };
