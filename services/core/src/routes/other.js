// Endpoints 18–20
const express = require('express');
const { Need, Visit, Commitment, Circle } = require('../models');
const { me, fail, ok, requireRole, checkId } = require('../lib/http');
const { view, isCoordinatorOf } = require('./commitments');

// 18. my circle, and the weeks other members cannot come (so I can cover them)
const circles = express.Router();
circles.get('/mine', async (req, res) => {
  const user = me(req);
  const circle = await Circle.findOne({ memberIds: user.id }).populate('memberIds', 'name');
  if (!circle) return ok(res, null);

  const others = circle.memberIds.filter(m => String(m._id) !== user.id).map(m => m._id);
  const withGaps = await Commitment.find({ volunteerId: { $in: others }, status: 'active', 'sessions.status': 'gap' })
    .populate('volunteerId', 'name')
    .populate('needId', 'title rhythm place');
  const openGaps = withGaps.flatMap(c => c.sessions.filter(s => s.status === 'gap').map(s => ({
    commitmentId: c._id,
    week: s.week,
    volunteerName: c.volunteerId.name,
    needTitle: c.needId.title,
    rhythm: c.needId.rhythm,
    place: c.needId.place,
    note: s.note || null,
  })));

  // handover notes from members who finished, so the circle knows where things stand
  const finished = await Commitment.find({ volunteerId: { $in: others }, status: 'finished', handover: { $ne: null } })
    .sort({ 'handover.at': -1 }).limit(5)
    .populate('volunteerId', 'name')
    .populate('needId', 'title');
  const handovers = finished.map(c => ({
    commitmentId: c._id,
    volunteerName: c.volunteerId.name,
    needTitle: c.needId.title,
    note: c.handover.note,
    at: c.handover.at,
  }));

  ok(res, {
    _id: circle._id,
    name: circle.name,
    members: circle.memberIds.map(m => ({ _id: m._id, name: m.name })),
    openGaps,
    handovers,
  });
});

// 19. the coordinator's whole picture
const coordinator = express.Router();
coordinator.get('/overview', async (req, res) => {
  requireRole(req, 'coordinator');
  const needs = await Need.find({ coordinatorId: me(req).id }).populate('orgId', 'name').sort({ createdAt: -1 });
  const needIds = needs.map(n => n._id);

  const pending = await Visit.find({ needId: { $in: needIds }, status: { $in: ['requested', 'visited'] } })
    .sort({ createdAt: -1 }).populate('needId', 'title').populate('volunteerId', 'name');
  const commitments = await Commitment.find({ needId: { $in: needIds } }).sort({ createdAt: -1 });
  // what volunteers heard, waiting for the coordinator to decide on an "Updated after listening" line
  const heard = await Visit.find({ needId: { $in: needIds }, heardText: { $nin: [null, ''] }, update: null })
    .sort({ updatedAt: -1 }).populate('needId').populate('volunteerId', 'name');

  ok(res, {
    needs: needs.map(n => ({
      _id: n._id, title: n.title, status: n.status, rhythm: n.rhythm, place: n.place, weeks: n.weeks, orgName: n.orgId?.name,
    })),
    pendingVisits: pending.map(v => ({
      _id: v._id,
      needId: v.needId._id,
      needTitle: v.needId.title,
      volunteerName: v.volunteerId.name,
      status: v.status,
      heardText: v.heardText,
      invitation: v.invitation,
    })),
    commitments: await Promise.all(commitments.map(c => view(c._id))),
    listeningUpdates: heard.map(v => ({
      visitId: v._id,
      volunteerName: v.volunteerId.name,
      heardText: v.heardText,
      need: {
        _id: v.needId._id, title: v.needId.title, want: v.needId.want, serveUsWell: v.needId.serveUsWell,
        youWillLearn: v.needId.youWillLearn, place: v.needId.place,
      },
    })),
  });
});

// 20. demo time travel: jump to a week, earlier upcoming weeks count as served
const demo = express.Router();
demo.post('/advance', async (req, res) => {
  const { commitmentId, toWeek } = req.body || {};
  const c = await Commitment.findById(checkId(commitmentId, 'Commitment'));
  if (!c) throw fail(404, 'Commitment not found');
  if (!(await isCoordinatorOf(c, me(req)))) throw fail(403, 'Only the coordinator of this need can do this');
  const target = parseInt(toWeek, 10);
  if (!(target >= 1 && target <= c.weeks)) throw fail(400, `Choose a week from 1 to ${c.weeks}`);

  c.currentWeek = target;
  c.sessions.forEach(s => { if (s.status === 'upcoming' && s.week < target) s.status = 'served'; });
  await c.save();
  ok(res, await view(c._id));
});

module.exports = { circles, coordinator, demo };
