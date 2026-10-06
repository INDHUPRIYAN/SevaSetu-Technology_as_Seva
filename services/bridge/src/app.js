// services/bridge/src/app.js — builds the app, does NOT listen. No database.
// The providers can be swapped in tests: createApp({ callLLM, callJSON, translate, transcribe, loadWisdom, draftTimeoutMs }).
const express = require('express');
const cors = require('cors');
const { bridgeRouter } = require('./routes/bridge');
const { aiRouter } = require('./routes/ai');
const { loadVerified } = require('./teachings');

function createApp(deps = {}) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '5mb' }));       // a 30-second 16 kHz WAV is about 1 MB, more as base64

  app.get('/health', (req, res) => res.json({ ok: true, service: 'bridge' }));

  const llm = require('./llm');
  const bhashini = require('./bhashini');
  const providers = {
    callLLM: llm.callLLM,
    callJSON: llm.callJSON,
    translate: bhashini.translate,
    transcribe: bhashini.transcribe,
    loadWisdom: loadVerified,
    draftTimeoutMs: Number(process.env.DRAFT_TIMEOUT_MS) || 8000,       // never wait more than 8 s on stage
    translateTimeoutMs: Number(process.env.TRANSLATE_TIMEOUT_MS) || 4000,
    ...deps,
  };
  app.use('/api/bridge', bridgeRouter(providers));
  app.use('/api/bridge', aiRouter({ ...providers, aiTimeoutMs: providers.aiTimeoutMs || providers.draftTimeoutMs }));

  app.use((req, res) => res.status(404).json({ error: { message: 'Not found' } }));

  // one error handler. It never logs the request body, which may hold audio or a coordinator's words.
  app.use((err, req, res, next) => {
    if (err.type === 'entity.too.large')
      return res.status(413).json({ error: { message: 'That recording is too long. Please keep it under 30 seconds.' } });
    const status = err.status || err.statusCode || 500;
    if (status >= 500) console.error('bridge error:', err.name, err.message);
    res.status(status).json({ error: { message: status >= 500 ? 'Something went wrong' : err.message } });
  });
  return app;
}
module.exports = { createApp };
