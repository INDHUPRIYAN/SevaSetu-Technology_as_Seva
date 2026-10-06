// services/gateway/src/app.js
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { createProxyMiddleware } = require('http-proxy-middleware');

const PUBLIC = ['/api/auth/users', '/api/auth/demo-login'];   // no token needed

// REFLECT_URL and BRIDGE_URL stay empty until Person B's services are integrated
function pickTarget(url) {
  if (url.startsWith('/api/reflect') || url.startsWith('/api/wisdom')) return process.env.REFLECT_URL;
  if (url.startsWith('/api/bridge')) return process.env.BRIDGE_URL;
  return process.env.CORE_URL;
}

function createApp() {
  const app = express();
  app.use(cors({ origin: process.env.WEB_ORIGIN || true }));
  // IMPORTANT: no express.json() here. If the gateway reads the body, the proxy sends an empty one.

  app.get('/health', (req, res) => res.json({ ok: true, service: 'gateway' }));

  // wake-up route: call this 2 minutes before the demo
  app.get('/health/all', async (req, res) => {
    const urls = [process.env.CORE_URL, process.env.REFLECT_URL, process.env.BRIDGE_URL];
    const results = await Promise.all(
      urls.map(u => (u ? fetch(u + '/health').then(r => r.ok).catch(() => false) : false))
    );
    res.json({ core: results[0], reflect: results[1], bridge: results[2] });
  });

  // auth: check the token, then tell the services who the user is
  app.use((req, res, next) => {
    delete req.headers['x-user-id'];             // never trust these from the browser
    delete req.headers['x-user-role'];
    if (PUBLIC.some(p => req.url.startsWith(p))) return next();
    try {
      const token = (req.headers.authorization || '').replace('Bearer ', '');
      const user = jwt.verify(token, process.env.JWT_SECRET);
      req.headers['x-user-id'] = user.sub;
      req.headers['x-user-role'] = user.role;
      next();
    } catch (e) {
      res.status(401).json({ error: { message: 'Please log in' } });
    }
  });

  // a service that is not integrated yet answers clearly instead of falling through to core
  app.use((req, res, next) => {
    if (pickTarget(req.url)) return next();
    res.status(503).json({ error: { message: 'This service is not connected yet' } });
  });

  // forward everything else, path unchanged
  app.use(createProxyMiddleware({
    target: process.env.CORE_URL,
    changeOrigin: true,
    router: req => pickTarget(req.url),
  }));
  return app;
}
module.exports = { createApp };
