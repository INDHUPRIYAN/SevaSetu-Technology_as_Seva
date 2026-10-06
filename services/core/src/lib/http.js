// Small helpers every route uses
const { isValidObjectId } = require('mongoose');

// the user, as told by the gateway (never from the body)
const me = req => ({ id: req.headers['x-user-id'], role: req.headers['x-user-role'] });

// throw fail(404, 'Need not found') inside a route; the error handler in app.js answers it
function fail(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

const ok = (res, data, status = 200) => res.status(status).json({ data });

function requireRole(req, role) {
  if (me(req).role !== role) throw fail(403, role === 'coordinator' ? 'Coordinators only' : 'Volunteers only');
}

// an id from the URL or body that is not even a valid ObjectId cannot exist
function checkId(id, what) {
  if (!isValidObjectId(id)) throw fail(404, `${what} not found`);
  return id;
}

module.exports = { me, fail, ok, requireRole, checkId };
