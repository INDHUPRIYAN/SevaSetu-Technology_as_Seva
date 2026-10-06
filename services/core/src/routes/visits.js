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
  invitation: v.invitation,
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

// 10. the community's answer, relayed by the coordinator: an invitation ("They would like you to come
// back", with its words) or not. Only the coordinator; the app never asks the volunteer first.
router.patch('/:id/decision', async (req, res) => {
  const visit = await Visit.findById(checkId(req.params.id, 'Visit')).populate('needId');
  if (!visit) throw fail(404, 'Visit not found');
  const user = me(req);
  if (user.role !== 'coordinator' || String(visit.needId.coordinatorId) !== user.id)
    throw fail(403, 'Only the coordinator relays the community’s answer');
  if (typeof req.body?.yes !== 'boolean') throw fail(400, 'Say yes or no');
  // listen first: nobody decides before the volunteer has visited and written what they heard
  if (visit.status === 'requested') throw fail(409, 'The visit has to happen first');
  if (visit.status !== 'visited') throw fail(409, 'The community has already answered');

  if (req.body.yes) {
    const text = String(req.body.text || '').trim() || 'They would like you to come back.';
    if (text.length > 300) throw fail(400, 'Please keep the invitation under 300 characters');
    visit.invitation = { text, sentAt: new Date() };
    visit.status = 'invited';
  } else {
    visit.status = 'declined';
  }
  await visit.save();

  const { needId, ...rest } = visit.toObject();
  ok(res, { ...rest, needId: needId._id });
});

// 10b. "Updated after listening": the coordinator approves (perhaps edited) or rejects one line for the
// need card, once per visit. An approved line shows on the card.
router.patch('/:id/update', async (req, res) => {
  const visit = await Visit.findById(checkId(req.params.id, 'Visit')).populate('needId');
  if (!visit) throw fail(404, 'Visit not found');
  if (me(req).role !== 'coordinator' || String(visit.needId.coordinatorId) !== me(req).id)
    throw fail(403, 'Only the coordinator of this need can update it');
  if (!visit.heardText) throw fail(409, 'The volunteer has not written what they heard yet');
  if (visit.update) throw fail(409, 'This visit has already been answered');

  const { action } = req.body || {};
  if (!['approve', 'reject'].includes(action)) throw fail(400, 'Approve or reject');
  const at = new Date();
  if (action === 'approve') {
    const text = String(req.body.text || '').trim();
    if (!text) throw fail(400, 'Please write the line to add');
    if (text.length > 300) throw fail(400, 'Please keep it to one line (under 300 characters)');
    await Need.updateOne({ _id: visit.needId._id }, { $push: { updates: { text, at, visitId: visit._id } } });
    visit.update = { status: 'approved', text, at };
  } else {
    visit.update = { status: 'rejected', at };
  }
  await visit.save();
  ok(res, { _id: visit._id, update: visit.update });
});

module.exports = router;
