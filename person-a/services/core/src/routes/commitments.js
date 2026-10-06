// Endpoints 11–17
const router = require('express').Router();
const { Need, Visit, Commitment, Circle } = require('../models');
const { me, fail, ok, requireRole, checkId } = require('../lib/http');

const sessionsFor = (from, count) =>
  Array.from({ length: count }, (_, i) => ({ week: from + i, status: 'upcoming' }));

const sameCircle = (a, b) => Circle.exists({ memberIds: { $all: [a, b] } });

async function load(id) {
  const c = await Commitment.findById(checkId(id, 'Commitment'));
  if (!c) throw fail(404, 'Commitment not found');
  return c;
}

const isOwner = (c, user) => user.role === 'volunteer' && String(c.volunteerId) === user.id;

async function isCoordinatorOf(c, user) {
  if (user.role !== 'coordinator') return false;
  return Boolean(await Need.exists({ _id: c.needId, coordinatorId: user.id }));
}

function week(c, body) {
  const n = Number(body?.week);
  const session = c.sessions.find(s => s.week === n);
  if (!session) throw fail(400, 'There is no such week in this commitment');
  return session;
}

async function view(id) {
  const c = await Commitment.findById(id)
    .populate('needId', 'title place rhythm orgId coordinatorId')
    .populate('volunteerId', 'name')
    .populate('sessions.coveredBy', 'name');
  const { needId, volunteerId, sessions, ...rest } = c.toObject();
  return {
    ...rest,
    needId: needId._id,
    need: { title: needId.title, place: needId.place, rhythm: needId.rhythm },
    volunteerId: volunteerId._id,
    volunteerName: volunteerId.name,
    sessions: sessions.map(s => ({
      week: s.week,
      status: s.status,
      coveredBy: s.coveredBy?._id || null,
      coveredByName: s.coveredBy?.name || null,
    })),
  };
}

// 11. commit, only after both sides said yes to the visit
router.post('/', async (req, res) => {
  requireRole(req, 'volunteer');
  const { visitId, sentence } = req.body || {};
  const visit = await Visit.findById(checkId(visitId, 'Visit'));
  if (!visit || String(visit.volunteerId) !== me(req).id || visit.status !== 'agreed')
    throw fail(409, 'You can commit only after you and the community both said yes');
  if (await Commitment.exists({ visitId: visit._id })) throw fail(409, 'You have already committed to this');

  const weeks = Math.min(Math.max(parseInt(req.body.weeks, 10) || 4, 1), 12);
  const c = await Commitment.create({
    visitId: visit._id,
    needId: visit.needId,
    volunteerId: visit.volunteerId,
    sentence: String(sentence || '').trim(),
    weeks,
    currentWeek: 1,
    sessions: sessionsFor(1, weeks),
  });
  await Need.updateOne({ _id: visit.needId }, { status: 'filled' });
  ok(res, await view(c._id), 201);
});

// 12. my commitments, newest first
router.get('/mine', async (req, res) => {
  const list = await Commitment.find({ volunteerId: me(req).id }).sort({ createdAt: -1 });
  ok(res, await Promise.all(list.map(c => view(c._id))));
});

// 13. one commitment: the volunteer, a circle member or the need's coordinator
router.get('/:id', async (req, res) => {
  const c = await load(req.params.id);
  const user = me(req);
  const allowed = isOwner(c, user)
    || (user.role === 'volunteer' && await sameCircle(c.volunteerId, user.id))
    || await isCoordinatorOf(c, user);
  if (!allowed) throw fail(403, 'This commitment is not yours to see');
  ok(res, await view(c._id));
});

// 14. "I cannot come this week"
router.post('/:id/absence', async (req, res) => {
  const c = await load(req.params.id);
  if (!isOwner(c, me(req))) throw fail(403, 'Only the volunteer can mark their own absence');
  const s = week(c, req.body);
  if (s.status !== 'upcoming') throw fail(409, `Week ${s.week} is already ${s.status}`);
  s.status = 'gap';
  await c.save();
  ok(res, await view(c._id));
});

// 15. a circle member covers the gap
router.post('/:id/cover', async (req, res) => {
  const c = await load(req.params.id);
  const user = me(req);
  if (user.role !== 'volunteer' || String(c.volunteerId) === user.id || !(await sameCircle(c.volunteerId, user.id)))
    throw fail(403, 'Only someone else from the same circle can cover');
  const s = week(c, req.body);
  if (s.status !== 'gap') throw fail(409, `Week ${s.week} does not need cover`);
  s.status = 'covered';
  s.coveredBy = user.id;
  await c.save();
  ok(res, await view(c._id));
});

// 16. the community invites the volunteer to continue
router.post('/:id/invitation', async (req, res) => {
  const c = await load(req.params.id);
  if (!(await isCoordinatorOf(c, me(req)))) throw fail(403, 'Only the coordinator of this need can invite');
  const text = String(req.body?.text || '').trim();
  if (!text) throw fail(400, 'Please write the invitation');
  c.invitation = { text, sentAt: new Date() };
  await c.save();
  ok(res, await view(c._id));
});

// 17. continue, pause or finish, only after an invitation
router.patch('/:id/continue', async (req, res) => {
  const c = await load(req.params.id);
  if (!isOwner(c, me(req))) throw fail(403, 'Only the volunteer can answer the invitation');
  const { choice } = req.body || {};
  if (!['continue', 'pause', 'finish'].includes(choice)) throw fail(400, 'Choose continue, pause or finish');
  if (!c.invitation) throw fail(409, 'Wait for the community to invite you');

  if (choice === 'continue') {
    c.sessions.push(...sessionsFor(c.weeks + 1, 4));
    c.weeks += 4;
    c.status = 'active';
  } else {
    c.status = choice === 'pause' ? 'paused' : 'finished';
  }
  c.lastChoice = choice;
  c.invitation = null;                               // answered; the next round needs a new invitation
  await c.save();
  ok(res, await view(c._id));
});

module.exports = { router, view, isCoordinatorOf };
