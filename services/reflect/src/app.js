// services/reflect/src/app.js — builds the app, does NOT listen
const express = require('express');
const cors = require('cors');
const { requireUser } = require('./user');

function createApp(options = {}) {
  const app = express();
  app.locals.now = options.now || (() => new Date());
  app.locals.timeZone = options.timeZone || process.env.WISDOM_TIME_ZONE || 'Asia/Kolkata';

  app.use(cors());
  app.use(express.json({ limit: '3mb' }));          // a private voice note is up to 2 MB of audio, as base64

  app.get('/health', (req, res) => res.json({ ok: true, service: 'reflect' }));

  // mounted at the full path, because the gateway forwards paths unchanged
  app.use('/api/reflect', requireUser, require('./routes/reflect'));
  app.use('/api/wisdom', requireUser, require('./routes/wisdom'));

  app.use((req, res) => res.status(404).json({ error: { message: 'Not found' } }));

  // one error handler for the whole service. Diary text never goes into the logs.
  app.use((err, req, res, next) => {
    const status = err.status || err.statusCode || (['CastError', 'ValidationError'].includes(err.name) ? 400 : 500);
    if (status >= 500) console.error('reflect error:', err.name, err.message);
    res.status(status).json({ error: { message: status >= 500 ? 'Something went wrong' : err.message } });
  });
  return app;
}
module.exports = { createApp };
