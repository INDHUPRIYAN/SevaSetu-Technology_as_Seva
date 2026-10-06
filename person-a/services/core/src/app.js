// services/core/src/app.js  — builds the app, does NOT listen
const express = require('express');
const cors = require('cors');
const commitments = require('./routes/commitments');
const { circles, coordinator, demo } = require('./routes/other');

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());                       // services parse JSON (the gateway does not)

  app.get('/health', (req, res) => res.json({ ok: true, service: 'core' }));

  // mounted at the full path, because the gateway forwards paths unchanged
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/needs', require('./routes/needs'));
  app.use('/api/visits', require('./routes/visits'));
  app.use('/api/commitments', commitments.router);
  app.use('/api/circles', circles);
  app.use('/api/coordinator', coordinator);
  app.use('/api/demo', demo);

  app.use((req, res) => res.status(404).json({ error: { message: 'Not found' } }));

  // one error handler for the whole service
  app.use((err, req, res, next) => {
    let status = err.status || 500;
    if (err.name === 'ValidationError' || err.type === 'entity.parse.failed') status = 400;
    if (err.code === 11000) status = 409;
    if (status === 500) console.error(err);
    res.status(status).json({ error: { message: status === 500 ? 'Something went wrong' : err.message } });
  });
  return app;
}
module.exports = { createApp };
