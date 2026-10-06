// Endpoints 8–10
const router = require('express').Router();
const { Need, Visit } = require('../models');
const { me, fail, ok, checkId } = require('../lib/http');

const visitView = v => ({
  _id: v._id,
  needId: v.needId._id,
  needTitle: v.needId.title,
  rhythm: v.needId.rhythm,
  place: v.needId.place,
  volunteerId: v.volunteerId._id,
  volunteerName: v.volunteerId.name,
  status: v.status,
  heardText: v.heardText,
  volunteerYes: v.volunteerYes,
  coordinatorYes: v.coordinatorYes,
  createdAt: v.createdAt,
});

async function visitsFor(user) {
  const filter = user.role === 'coordinator'
    ? { needId: { $in: await Need.find({ coordinatorId: user.id }).distinct('_id') } }
    : { volunteerId: user.id };
  const visits = await Visit.find(filter).sort({ createdAt: -1 }).populate('needId').populate('volunteerId', 'name');
  return visits.map(visitView);
}

// 8. a volunteer's own visits, or the visits for a coordinator's needs
router.get('/mine', async (req, res) => {
  ok(res, await visitsFor(me(req)));
});

// 9. "What did you hear that you did not expect?"
router.patch('/:id/heard', async (req, res) => {
  const visit = await Visit.findById(checkId(req.params.id, 'Visit'));
  if (!visit) throw fail(404, 'Visit not found');
  if (me(req).role !== 'volunteer' || String(visit.volunteerId) !== me(req).id)
    throw fail(403, 'Only the volunteer who visited can write this');
  const text = String(req.body?.text ?? req.body?.heardText ?? '').trim();
  if (!text) throw fail(400, 'Please write what you heard');
  if (!['requested', 'visited'].includes(visit.status)) throw fail(409, 'Both sides have already answered');

  visit.heardText = text;
  visit.status = 'visited';
  await visit.save();
  ok(res, visit);
});

// 10. each side says yes or no; both yes means agreed
router.patch('/:id/decision', async (req, res) => {
  const visit = await Visit.findById(checkId(req.params.id, 'Visit')).populate('needId');
  if (!visit) throw fail(404, 'Visit not found');
  const user = me(req);
  if (typeof req.body?.yes !== 'boolean') throw fail(400, 'Say yes or no');

  if (user.role === 'volunteer' && String(visit.volunteerId) === user.id) {
    visit.volunteerYes = req.body.yes;
  } else if (user.role === 'coordinator' && String(visit.needId.coordinatorId) === user.id) {
    visit.coordinatorYes = req.body.yes;
  } else {
    throw fail(403, 'This visit is not yours to answer');
  }
  // listen first: nobody decides before the volunteer has visited and written what they heard
  if (visit.status !== 'visited') throw fail(409, 'The visit has to happen first');

  if (visit.volunteerYes === false || visit.coordinatorYes === false) visit.status = 'declined';
  else if (visit.volunteerYes && visit.coordinatorYes) visit.status = 'agreed';
  await visit.save();

  const { needId, ...rest } = visit.toObject();
  ok(res, { ...rest, needId: needId._id });
});

module.exports = router;
