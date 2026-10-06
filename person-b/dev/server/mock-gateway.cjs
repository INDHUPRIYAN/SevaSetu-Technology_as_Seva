// DEV-ONLY stand-in for Person A's gateway + the few core endpoints B's screens call.
// It follows A's gateway rules exactly: x-user-* headers from the browser are dropped, the token is
// checked, and /api/reflect, /api/wisdom and /api/bridge are forwarded unchanged to B's real services.
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { ids } = require('../../seed/seed-reflect');

const PUBLIC = ['/api/auth/users', '/api/auth/demo-login'];
const NEED_KEYS = ['title', 'want', 'serveUsWell', 'youWillLearn', 'groupSize', 'interestTags', 'rhythm', 'weeks', 'place'];

// invented names only
const USERS = [
  { _id: ids.users.newVolunteer, name: 'Meera Sundar', role: 'volunteer', note: 'New volunteer (live demo)' },
  { _id: ids.users.seededVolunteer, name: 'Kavya Raman', role: 'volunteer', note: 'Seeded volunteer, week 2 of 4' },
  { _id: ids.users.circleMember, name: 'Arjun Mohan', role: 'volunteer', note: 'Circle member' },
  { _id: ids.users.coordinator, name: 'Lakshmi Narayanan', role: 'coordinator', note: 'Coordinator' },
];

const NEED = { _id: ids.needs.englishReading, title: 'English Reading Support', place: 'Government School, Kanchipuram',
  rhythm: { day: 'Saturday', start: '10:30', end: '12:00' } };

// The shape of A's endpoint 13 that B's diary reads: currentWeek, weeks, need.title
const COMMITMENTS = {
  [ids.commitments.seeded]: { _id: ids.commitments.seeded, volunteerId: ids.users.seededVolunteer, circle: [ids.users.circleMember],
    currentWeek: 2, weeks: 4, need: NEED },
  '650000000000000000000042': { _id: '650000000000000000000042', volunteerId: ids.users.newVolunteer, circle: [],
    currentWeek: 1, weeks: 4, need: NEED },
};

const fail = (res, status, message, extra) => res.status(status).json({ error: { message, ...extra } });

function needFieldErrors(body) {
  const errors = [];
  const text = k => typeof body[k] === 'string' && body[k].trim();
  for (const k of ['title', 'want', 'serveUsWell', 'youWillLearn', 'place']) if (!text(k)) errors.push(k);
  if (!Number.isInteger(body.groupSize) || body.groupSize < 1) errors.push('groupSize');
  if (!Number.isInteger(body.weeks) || body.weeks < 1) errors.push('weeks');
  if (!Array.isArray(body.interestTags) || !body.interestTags.every(t => typeof t === 'string')) errors.push('interestTags');
  const r = body.rhythm;
  if (!r || typeof r !== 'object' || !['day', 'start', 'end'].every(k => typeof r[k] === 'string' && r[k])) errors.push('rhythm');
  return errors;
}

function createMockGateway({ reflectUrl, bridgeUrl, secret = 'dev-only-secret', onReset } = {}) {
  const needs = [];
  const app = express();
  app.use(cors());

  app.get('/health', (req, res) => res.json({ ok: true, service: 'gateway (person-b mock)' }));
  app.get('/health/all', async (req, res) => {
    const ok = u => fetch(`${u}/health`).then(r => r.ok).catch(() => false);
    res.json({ core: true, reflect: await ok(reflectUrl), bridge: await ok(bridgeUrl) });
  });

  // test-only: reseed the in-memory reflect database and forget published needs
  app.post('/__dev/reset', async (req, res) => {
    if (!onReset) return fail(res, 403, 'Reset is only allowed on the in-memory database');
    needs.length = 0;
    await onReset();
    res.json({ data: { ok: true } });
  });

  // auth, as in A's gateway
  app.use((req, res, next) => {
    delete req.headers['x-user-id'];
    delete req.headers['x-user-role'];
    if (PUBLIC.some(p => req.url.startsWith(p))) return next();
    try {
      const user = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), secret);
      req.headers['x-user-id'] = user.sub;
      req.headers['x-user-role'] = user.role;
      next();
    } catch (e) {
      fail(res, 401, 'Please log in');
    }
  });

  const me = req => USERS.find(u => u._id === req.headers['x-user-id']);
  const json = express.json();

  // 1–3
  app.get('/api/auth/users', (req, res) => res.json({ data: USERS }));
  app.post('/api/auth/demo-login', json, (req, res) => {
    const user = USERS.find(u => u._id === req.body?.userId);
    if (!user) return fail(res, 404, 'No such user');
    const token = jwt.sign({ sub: user._id, role: user.role }, secret, { expiresIn: '12h' });
    res.json({ data: { token, user: { _id: user._id, name: user.name, role: user.role } } });
  });
  app.get('/api/auth/me', (req, res) => res.json({ data: me(req) }));

  // 13 — only the volunteer, a circle member or the coordinator
  app.get('/api/commitments/:id', (req, res) => {
    const c = COMMITMENTS[req.params.id];
    if (!c) return fail(res, 404, 'No such commitment');
    const user = me(req);
    const allowed = user && (user._id === c.volunteerId || c.circle.includes(user._id) || user.role === 'coordinator');
    if (!allowed) return fail(res, 403, 'Not your commitment');
    res.json({ data: c });
  });

  // 4–6 (just enough: list, one, create with A's rules)
  app.get('/api/needs', (req, res) => res.json({ data: needs.filter(n => n.status === 'open') }));
  app.get('/api/needs/:id', (req, res) => {
    const need = needs.find(n => n._id === req.params.id);
    if (!need) return fail(res, 404, 'No such need');
    res.json({ data: need });
  });
  app.post('/api/needs', json, (req, res) => {
    if (req.headers['x-user-role'] !== 'coordinator') return fail(res, 403, 'Coordinators only');
    const body = req.body || {};
    if (body.consent?.readBack !== true) return fail(res, 400, 'Please read the card back to the community first');
    const unknown = Object.keys(body).filter(k => ![...NEED_KEYS, 'consent'].includes(k));
    if (unknown.length) return fail(res, 400, `Unknown field: ${unknown.join(', ')}`, { fields: unknown });
    const fields = needFieldErrors(body);
    if (fields.length) return fail(res, 400, `Please check: ${fields.join(', ')}`, { fields });
    const need = { _id: crypto.randomBytes(12).toString('hex'), ...body, status: 'open', coordinatorId: req.headers['x-user-id'] };
    needs.push(need);
    res.status(201).json({ data: need });
  });

  // forward B's paths unchanged
  const forward = target => createProxyMiddleware({ target, changeOrigin: true });
  const reflect = forward(reflectUrl);
  const bridge = forward(bridgeUrl);
  app.use((req, res, next) => {
    if (req.url.startsWith('/api/reflect') || req.url.startsWith('/api/wisdom')) return reflect(req, res, next);
    if (req.url.startsWith('/api/bridge')) return bridge(req, res, next);
    fail(res, 404, 'Not in the Person B mock gateway');
  });
  return app;
}

module.exports = { createMockGateway, USERS };
