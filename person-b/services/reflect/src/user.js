// The gateway checks the token and sets these headers. The user never comes from the body.
const me = req => ({ id: req.headers['x-user-id'], role: req.headers['x-user-role'] });

// Without a user id, a diary query would have no owner filter at all, so refuse it outright.
// (The gateway already answers 401 for a missing token; this guards a direct call to the service.)
function requireUser(req, res, next) {
  if (!me(req).id) return res.status(401).json({ error: { message: 'Please log in' } });
  next();
}

module.exports = { me, requireUser };
