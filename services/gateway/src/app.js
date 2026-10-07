// services/gateway/src/app.js
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const PUBLIC = ['/api/auth/users', '/api/auth/demo-login'];   // no token needed

function serviceFor(url) {
  if (url.startsWith('/api/reflect') || url.startsWith('/api/wisdom')) return 'reflect';
  if (url.startsWith('/api/bridge')) return 'bridge';
  return 'core';
}

// REFLECT_URL and BRIDGE_URL stay empty until Person B's services are integrated
const URLS = () => ({ core: process.env.CORE_URL, reflect: process.env.REFLECT_URL, bridge: process.env.BRIDGE_URL });
const pickTarget = url => URLS()[serviceFor(url)];

// options.local = { core: app, reflect: app, bridge: app } runs the services in this process
// instead of proxying to them (used by mono.js). Without it, every service is a URL.
function createApp(options = {}) {
  const local = options.local;
  const app = express();
  app.use(cors({ origin: process.env.WEB_ORIGIN || true }));
  // IMPORTANT: no express.json() here. If the gateway reads the body, the proxy sends an empty one.

  app.get('/health', (req, res) => res.json({ ok: true, service: 'gateway' }));

  // wake-up route: call this 2 minutes before the demo
  app.get('/health/all', async (req, res) => {
    if (local) return res.json({ core: !!local.core, reflect: !!local.reflect, bridge: !!local.bridge });
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
    if (local ? local[serviceFor(req.url)] : pickTarget(req.url)) return next();
    res.status(503).json({ error: { message: 'This service is not connected yet' } });
  });

  if (local) {
    app.use((req, res, next) => local[serviceFor(req.url)](req, res, next));
    return app;
  }

  // forward everything else, path unchanged. Loaded only here: the in-process setup (mono.js, the Vercel
  // function) never proxies, and the package is ES-module-only, which some Node runtimes cannot require().
  const { createProxyMiddleware } = require('http-proxy-middleware');
  app.use(createProxyMiddleware({
    target: process.env.CORE_URL,
    changeOrigin: true,
    router: req => pickTarget(req.url),
  }));
  return app;
}
module.exports = { createApp };
