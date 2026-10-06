// Resource Connect (coordinators only): an organisation offers or asks for things, SevaSetu suggests
// matches of the same type from other organisations, the two coordinators connect, then mark the
// handover done. Matching is plain code: same type, opposite kind, both open; same city first,
// then whether the quantity covers the request, then the earliest date.
const router = require('express').Router();
const { Resource, User } = require('../models');
const { me, fail, ok, requireRole, checkId } = require('../lib/http');

async function myOrg(req) {
  requireRole(req, 'coordinator');
  const user = await User.findById(me(req).id);
  if (!user?.orgId) throw fail(400, 'This coordinator has no organisation');
  return user.orgId;
}

const orgView = o => (o ? { _id: o._id, name: o.name, place: o.place, city: o.city, verified: o.verified } : null);

const view = r => ({
  _id: r._id,
  kind: r.kind,
  type: r.type,
  quantity: r.quantity,
  availableFrom: r.availableFrom,
  note: r.note,
  status: r.status,
  org: orgView(r.orgId),
  matchedWith: r.matchedWith?._id ? view(r.matchedWith) : r.matchedWith || null,
  handedOverAt: r.handedOverAt,
});

function rank(mine) {
  return (a, b) => {
    const city = x => (x.orgId?.city === mine.orgId?.city ? 0 : 1);
    if (city(a) !== city(b)) return city(a) - city(b);
    const covers = x => {
      const offer = mine.kind === 'request' ? x : mine;
      const request = mine.kind === 'request' ? mine : x;
      return offer.quantity >= request.quantity ? 0 : 1;
    };
    if (covers(a) !== covers(b)) return covers(a) - covers(b);
    return String(a.availableFrom || '').localeCompare(String(b.availableFrom || ''));
  };
}

async function candidatesFor(r) {
  const list = await Resource.find({
    type: r.type,
    kind: r.kind === 'offer' ? 'request' : 'offer',
    status: 'open',
    orgId: { $ne: r.orgId._id || r.orgId },
  }).populate('orgId');
  return list.sort(rank(r)).slice(0, 3).map(view);
}

// my organisation's offers and requests; open ones come with up to 3 suggested matches
router.get('/mine', async (req, res) => {
  const orgId = await myOrg(req);
  const list = await Resource.find({ orgId }).sort({ createdAt: -1 })
    .populate('orgId').populate({ path: 'matchedWith', populate: 'orgId' });
  ok(res, await Promise.all(list.map(async r => ({
    ...view(r),
    candidates: r.status === 'open' ? await candidatesFor(r) : [],
  }))));
});

// offer or ask for something
router.post('/', async (req, res) => {
  const orgId = await myOrg(req);
  const { kind, type, quantity, availableFrom, note } = req.body || {};
  if (!['offer', 'request'].includes(kind)) throw fail(400, 'Say whether you offer or need it');
  if (!String(type || '').trim()) throw fail(400, 'Say what it is, for example "tablets"');
  const n = Number(quantity);
  if (!Number.isInteger(n) || n < 1) throw fail(400, 'Please give how many (1 or more)');
  if (availableFrom && !/^\d{4}-\d{2}-\d{2}$/.test(availableFrom)) throw fail(400, 'Please give the date as YYYY-MM-DD');
  const r = await Resource.create({ orgId, kind, type, quantity: n, availableFrom: availableFrom || null, note: String(note || '').trim() });
  await r.populate('orgId');
  ok(res, { ...view(r), candidates: await candidatesFor(r) }, 201);
});

// connect my open resource with a suggested one from another organisation
router.post('/:id/connect', async (req, res) => {
  const orgId = await myOrg(req);
  const mine = await Resource.findById(checkId(req.params.id, 'Resource'));
  if (!mine) throw fail(404, 'Resource not found');
  if (String(mine.orgId) !== String(orgId)) throw fail(403, 'This is not your organisation\'s resource');
  const other = await Resource.findById(checkId(req.body?.withId, 'Resource'));
  if (!other) throw fail(404, 'Resource not found');
  if (mine.status !== 'open' || other.status !== 'open') throw fail(409, 'One of these is already connected');
  if (other.type !== mine.type || other.kind === mine.kind || String(other.orgId) === String(mine.orgId))
    throw fail(409, 'These two do not match');

  mine.status = other.status = 'matched';
  mine.matchedWith = other._id;
  other.matchedWith = mine._id;
  await Promise.all([mine.save(), other.save()]);
  await mine.populate(['orgId', { path: 'matchedWith', populate: 'orgId' }]);
  ok(res, { ...view(mine), candidates: [] });
});

// the things changed hands
router.post('/:id/handover', async (req, res) => {
  const orgId = await myOrg(req);
  const mine = await Resource.findById(checkId(req.params.id, 'Resource'));
  if (!mine) throw fail(404, 'Resource not found');
  if (String(mine.orgId) !== String(orgId)) throw fail(403, 'This is not your organisation\'s resource');
  if (mine.status !== 'matched') throw fail(409, 'Connect with a match first');
  const at = new Date();
  await Resource.updateMany({ _id: { $in: [mine._id, mine.matchedWith] } }, { status: 'handed-over', handedOverAt: at });
  const done = await Resource.findById(mine._id).populate(['orgId', { path: 'matchedWith', populate: 'orgId' }]);
  ok(res, { ...view(done), candidates: [] });
});

module.exports = router;
