// Endpoints 11–17
const router = require('express').Router();
const { Need, Visit, Commitment, Circle } = require('../models');
const { me, fail, ok, requireRole, checkId } = require('../lib/http');

const CHECK_IN_EVERY = 4;                         // weeks between Community Check-ins

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

// who the promise is kept for, in the words the need itself uses: "The children were never left waiting"
function groupOf(need) {
  const words = `${need.title} ${need.want || ''}`;
  if (/\b(children|students?|class|school)\b/i.test(words)) return 'The children';
  if (/\belders?\b/i.test(words)) return 'The elders';
  return 'The community';
}

async function view(id) {
  const c = await Commitment.findById(id)
    .populate('needId', 'title place rhythm want orgId coordinatorId')
    .populate('volunteerId', 'name')
    .populate('sessions.coveredBy', 'name');
  const { needId, volunteerId, sessions, ...rest } = c.toObject();
  return {
    ...rest,
    needId: needId._id,
    need: { title: needId.title, place: needId.place, rhythm: needId.rhythm, group: groupOf(needId) },
    volunteerId: volunteerId._id,
    volunteerName: volunteerId.name,
    checkInDue: rest.status === 'active' && rest.currentWeek >= CHECK_IN_EVERY * ((rest.checkIns?.length || 0) + 1),
    sessions: sessions.map(s => ({
      week: s.week,
      status: s.status,
      coveredBy: s.coveredBy?._id || null,
      coveredByName: s.coveredBy?.name || null,
      note: s.note || null,
    })),
  };
}

// 11. commit: a completed visit + the community's invitation + this, the volunteer's acceptance
router.post('/', async (req, res) => {
  requireRole(req, 'volunteer');
  const { visitId, sentence } = req.body || {};
  const visit = await Visit.findById(checkId(visitId, 'Visit'));
  if (!visit || String(visit.volunteerId) !== me(req).id) throw fail(409, 'This visit is not yours');
  if (!visit.heardText) throw fail(409, 'Visit and listen first');
  if (visit.status !== 'invited' || !visit.invitation)
    throw fail(409, 'You can commit only after the community has invited you');
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

// 14. "I cannot come this week": one tap, no penalty. Sending it again for the same week only
// adds or changes the note for whoever covers.
router.post('/:id/absence', async (req, res) => {
  const c = await load(req.params.id);
  if (!isOwner(c, me(req))) throw fail(403, 'Only the volunteer can mark their own absence');
  const s = week(c, req.body);
  if (!['upcoming', 'gap'].includes(s.status)) throw fail(409, `Week ${s.week} is already ${s.status}`);
  const note = String(req.body?.note || '').trim();
  if (note.length > 300) throw fail(400, 'Please keep the note under 300 characters');
  s.status = 'gap';
  if (note || s.note === null) s.note = note || null;
  await c.save();
  ok(res, await view(c._id));
});

// 14b. Silent Seva: "Session over" marks this week served. Only the volunteer, only a week that has come.
router.post('/:id/served', async (req, res) => {
  const c = await load(req.params.id);
  if (!isOwner(c, me(req))) throw fail(403, 'Only the volunteer can mark their own session');
  if (c.status !== 'active') throw fail(409, 'This seva is not active');
  const s = week(c, req.body);
  if (s.week > c.currentWeek) throw fail(409, `Week ${s.week} has not come yet`);
  if (s.status === 'served') return ok(res, await view(c._id));             // a second tap changes nothing
  if (s.status !== 'upcoming') throw fail(409, `Week ${s.week} is already ${s.status}`);
  s.status = 'served';
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

// 16b. Community Check-in, every 4 weeks: the coordinator enters the three answers given in person.
// The community can end the arrangement here; the need then closes.
router.post('/:id/check-in', async (req, res) => {
  const c = await load(req.params.id);
  if (!(await isCoordinatorOf(c, me(req)))) throw fail(403, 'Only the coordinator of this need can enter a check-in');
  if (c.status !== 'active') throw fail(409, 'This seva is not active');
  const nextWeek = CHECK_IN_EVERY * (c.checkIns.length + 1);
  if (c.currentWeek < nextWeek) throw fail(409, `The next check-in is in week ${nextWeek}`);

  const answer = key => String(req.body?.[key] || '').trim();
  const [helping, change, ownNow] = ['helping', 'change', 'ownNow'].map(answer);
  if (!helping || !change || !ownNow) throw fail(400, 'Please write the community’s answer to all three questions');
  if ([helping, change, ownNow].some(a => a.length > 500)) throw fail(400, 'Please keep each answer under 500 characters');
  const ended = req.body?.end === true;

  c.checkIns.push({ week: c.currentWeek, helping, change, ownNow, ended, at: new Date() });
  if (ended) {
    c.status = 'finished';
    c.lastChoice = 'community-ended';
    c.invitation = null;
    await Need.updateOne({ _id: c.needId }, { status: 'closed' });
  }
  await c.save();
  ok(res, await view(c._id));
});

// Words that must never reach a volunteer as "the community's words": money and the words we avoid. Names
// are caught by the Dignity Check in the bridge, which the coordinator runs and approves before saving.
const MONEY = /₹|\brs\.?\s*\d|\brupees?\b|\bincome\b|\bsalary\b|\bwages?\b|\bfees?\b/i;
const AVOID = /\b(poor|needy|beneficiar(y|ies)|donat(e|ion|ions)|case)\b/i;

// 17b. "What the group wanted to say": the coordinator relays one line from the group once the seva has
// finished. Stored as said, in its own language, and shown to the volunteer as the community's words.
router.post('/:id/community-words', async (req, res) => {
  const c = await load(req.params.id);
  if (!(await isCoordinatorOf(c, me(req)))) throw fail(403, 'Only the coordinator of this need can relay the group’s words');
  if (c.status !== 'finished') throw fail(409, 'The group’s words are relayed once the seva has finished');
  if (c.communityWords) throw fail(409, 'The group’s words have already been relayed');
  const text = String(req.body?.text || '').trim();
  const language = ['en', 'ta', 'hi'].includes(req.body?.language) ? req.body.language : 'en';
  if (!text) throw fail(400, 'Please write what the group wanted to say');
  if (text.length > 300) throw fail(400, 'Please keep it to one line (under 300 characters)');
  if (MONEY.test(text)) throw fail(400, 'Please leave money out of the group’s words');
  if (AVOID.test(text)) throw fail(400, 'Please avoid the words poor, needy, beneficiary, donate and case');
  if (req.body?.dignityChecked !== true) throw fail(400, 'Please run the Dignity Check and approve the words first');
  c.communityWords = { text, language, at: new Date() };
  await c.save();
  ok(res, await view(c._id));
});

const isDate = v => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

// 17. continue (only when the community has invited), pause (with a return date) or finish (with a
// handover note for the next volunteer; the need opens again for them)
router.patch('/:id/continue', async (req, res) => {
  const c = await load(req.params.id);
  if (!isOwner(c, me(req))) throw fail(403, 'Only the volunteer can answer the invitation');
  const { choice } = req.body || {};
  if (!['continue', 'pause', 'finish'].includes(choice)) throw fail(400, 'Choose continue, pause or finish');
  if (c.status === 'finished') throw fail(409, 'This seva is already finished');

  if (choice === 'continue') {
    if (!c.invitation) throw fail(409, 'Wait for the community to invite you');
    c.sessions.push(...sessionsFor(c.weeks + 1, 4));
    c.weeks += 4;
    c.status = 'active';
    c.pausedUntil = null;
  } else if (choice === 'pause') {
    const returnDate = String(req.body.returnDate || '');
    const today = new Date().toISOString().slice(0, 10);
    if (!isDate(returnDate) || returnDate <= today) throw fail(400, 'Please choose the date you plan to return');
    c.status = 'paused';
    c.pausedUntil = returnDate;
  } else {
    const note = String(req.body.handover || '').trim();
    if (!note) throw fail(400, 'Please leave a handover note for the next volunteer');
    if (note.length > 1000) throw fail(400, 'Please keep the handover note under 1000 characters');
    c.status = 'finished';
    c.pausedUntil = null;
    c.handover = { note, at: new Date() };
    await Need.updateOne({ _id: c.needId }, { status: 'open', handover: c.handover });
  }
  c.lastChoice = choice;
  c.invitation = null;                               // answered; the next round needs a new invitation
  await c.save();
  ok(res, await view(c._id));
});

module.exports = { router, view, isCoordinatorOf };
