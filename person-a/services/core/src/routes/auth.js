// Endpoints 1–3
const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { me, fail, ok, checkId } = require('../lib/http');

// 1. public: the demo users to pick from
router.get('/users', async (req, res) => {
  ok(res, await User.find({}, '_id name role').sort({ _id: 1 }));
});

// 2. public: pick a user, get a token
router.post('/demo-login', async (req, res) => {
  const user = await User.findById(checkId(req.body?.userId, 'User'));
  if (!user) throw fail(404, 'User not found');
  const token = jwt.sign({ sub: String(user._id), role: user.role }, process.env.JWT_SECRET, { expiresIn: '12h' });
  ok(res, { token, user });
});

// 3. who am I
router.get('/me', async (req, res) => {
  const user = await User.findById(checkId(me(req).id, 'User'));
  if (!user) throw fail(404, 'User not found');
  ok(res, user);
});

module.exports = router;
