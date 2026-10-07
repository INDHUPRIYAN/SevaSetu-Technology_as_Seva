// Endpoints 4–7
const router = require('express').Router();
const { Need, User, Visit, Commitment, LANGUAGE_CODES } = require('../models');
const { me, fail, ok, requireRole, checkId } = require('../lib/http');

function partOfDay(start = '') {
  const hour = parseInt(start, 10);
  if (Number.isNaN(hour)) return '';
  return hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
}

// plain sentence built in code, no AI: "Saturday morning, 3 km away, you said you enjoy teaching."
function fitReason(need, interest) {
  const when = [need.rhythm?.day, partOfDay(need.rhythm?.start)].filter(Boolean).join(' ');
  const parts = [when, `${need.orgId.distanceKm} km away`];
  if (interest) parts.push(`you said you enjoy ${interest}`);
  return parts.join(', ') + '.';
}

const orgView = org => ({ _id: org._id, name: org.name, place: org.place, city: org.city, distanceKm: org.distanceKm, verified: org.verified });

// 4. at most 3 needs that fit the volunteer's answers
router.get('/', async (req, res) => {
  const { day, maxKm, interest } = req.query;
  const filter = { status: 'open' };
  if (day) filter['rhythm.day'] = day;
  if (interest) filter.interestTags = interest;

  const needs = (await Need.find(filter).populate('orgId'))
    .filter(n => n.orgId && (!maxKm || n.orgId.distanceKm <= Number(maxKm)))
    .sort((a, b) => a.orgId.distanceKm - b.orgId.distanceKm)
    .slice(0, 3);

  ok(res, needs.map(n => {
    const { orgId, ...rest } = n.toObject();
    return { ...rest, org: orgView(n.orgId), verified: n.orgId.verified, fitReason: fitReason(n, interest) };
  }));
});

// 5. the full card
router.get('/:id', async (req, res) => {
  const need = await Need.findById(checkId(req.params.id, 'Need')).populate('orgId');
  if (!need) throw fail(404, 'Need not found');
  const { orgId, ...rest } = need.toObject();
  ok(res, { ...rest, org: orgView(need.orgId), verified: need.orgId.verified });
});

// 6. a coordinator publishes a need, only after reading it back to the community
router.post('/', async (req, res) => {
  requireRole(req, 'coordinator');
  const b = req.body || {};
  // AI only drafts: a person reads the card back, the community confirms, the coordinator consents
  if (b.consent?.readBack !== true)
    throw fail(400, 'Read the need back to the community and tick that they confirmed it');
  if (b.consent?.coordinatorConsent !== true)
    throw fail(400, 'Please give your consent to publish');
  if (!b.title || !String(b.title).trim()) throw fail(400, 'Please give the need a title');

  // the words as the community said them, in their language
  let original = null;
  if (b.original?.text && String(b.original.text).trim()) {
    const language = LANGUAGE_CODES.includes(b.original.language) ? b.original.language : 'en';
    original = { text: String(b.original.text).trim().slice(0, 5000), language };
  }

  const coordinator = await User.findById(me(req).id);
  if (!coordinator?.orgId) throw fail(400, 'This coordinator has no organisation');

  const need = await Need.create({
    orgId: coordinator.orgId,
    coordinatorId: coordinator._id,
    title: b.title,
    want: b.want,
    serveUsWell: b.serveUsWell,
    youWillLearn: b.youWillLearn,
    groupSize: b.groupSize,
    interestTags: b.interestTags,
    rhythm: b.rhythm,
    weeks: b.weeks || 4,
    place: b.place,
    original,
    status: 'open',
    consent: { readBack: true, coordinatorConsent: true, agreedOn: b.consent.agreedOn || new Date().toISOString().slice(0, 10) },
  });
  ok(res, need, 201);
});

// 7. a volunteer asks to visit and listen first
router.post('/:id/visits', async (req, res) => {
  requireRole(req, 'volunteer');
  const need = await Need.findById(checkId(req.params.id, 'Need'));
  if (!need) throw fail(404, 'Need not found');
  if (await Visit.exists({ needId: need._id, volunteerId: me(req).id }))
    throw fail(409, 'You have already asked to visit this community');
  if (need.status !== 'open') throw fail(409, 'This need is already filled');
  ok(res, await Visit.create({ needId: need._id, volunteerId: me(req).id }), 201);
});

// 6b. the need ends (a school shuts, an organisation moves): the coordinator closes it. Every active or
// paused commitment on it is marked finished, as complete and not failed; the volunteer makes no choice.
router.patch('/:id/close', async (req, res) => {
  requireRole(req, 'coordinator');
  const need = await Need.findById(checkId(req.params.id, 'Need'));
  if (!need) throw fail(404, 'Need not found');
  if (String(need.coordinatorId) !== me(req).id) throw fail(403, 'Only the coordinator of this need can close it');
  if (need.status === 'closed') throw fail(409, 'This need is already closed');
  const reason = String(req.body?.reason || '').trim();
  if (reason.length > 300) throw fail(400, 'Please keep the reason under 300 characters');

  need.status = 'closed';
  need.closed = { reason: reason || null, at: new Date() };
  await need.save();
  const { modifiedCount } = await Commitment.updateMany(
    { needId: need._id, status: { $in: ['active', 'paused'] } },
    { $set: { status: 'finished', lastChoice: 'need-closed', invitation: null, pausedUntil: null } },
  );
  ok(res, { _id: need._id, status: need.status, closed: need.closed, commitmentsFinished: modifiedCount });
});

module.exports = router;
