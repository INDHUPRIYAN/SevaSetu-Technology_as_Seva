// Endpoints 21–24: the private Seva Diary and the sealed Sankalpa. Every query is filtered by the caller's own id.
const router = require('express').Router();
const Question = require('../models/Question');
const Entry = require('../models/Entry');
const Sankalpa = require('../models/Sankalpa');
const Received = require('../models/Received');
const VoiceNote = require('../models/VoiceNote');
const { me } = require('../user');

const QUESTION_COUNT = 5;                        // the five diary questions rotate week by week
const MAX_TEXT = 4000;

const bad = (res, message) => res.status(400).json({ error: { message } });

function parseWeek(value) {
  if (value === undefined || value === null || value === '') return null;
  const week = Number(value);
  return Number.isInteger(week) && week >= 1 && week <= 520 ? week : null;
}

const orderForWeek = week => ((week - 1) % QUESTION_COUNT) + 1;

const commitmentIdFrom = value => (typeof value === 'string' && value.trim() ? value.trim() : null);

const publicQuestion = q => (q ? { _id: q._id, theme: q.theme, text: q.text, teaching: q.teaching } : null);

// Only what the diary's owner wrote, plus the question it answered.
async function withQuestions(entries) {
  const ids = [...new Set(entries.map(e => String(e.questionId)))];
  const questions = await Question.find({ _id: { $in: ids } }).lean();
  const byId = new Map(questions.map(q => [String(q._id), q]));
  return entries.map(e => ({
    _id: e._id,
    commitmentId: e.commitmentId,
    week: e.week,
    text: e.text,
    hardDay: e.hardDay,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
    question: publicQuestion(byId.get(String(e.questionId))),
  }));
}

// 21. The one question for this week
router.get('/question', async (req, res) => {
  const week = parseWeek(req.query.week);
  if (!week) return bad(res, 'Please give the week (1 or more)');
  const question = await Question.findOne({ order: orderForWeek(week) }).lean();
  if (!question) return res.status(404).json({ error: { message: 'No question for this week yet' } });
  res.json({ data: publicQuestion(question) });
});

// 22. Save this week's entry. Writing again in the same week updates it.
router.post('/entries', async (req, res) => {
  const { commitmentId: rawCommitmentId, week: rawWeek, text, hardDay } = req.body || {};
  const commitmentId = commitmentIdFrom(rawCommitmentId);
  const week = parseWeek(rawWeek);
  if (!commitmentId) return bad(res, 'commitmentId is needed');
  if (!week) return bad(res, 'Please give the week (1 or more)');
  if (typeof text !== 'string' || !text.trim()) return bad(res, 'Please write a few words before saving');
  if (text.trim().length > MAX_TEXT) return bad(res, `Please keep it under ${MAX_TEXT} characters`);

  // The question is fixed by the week, so the server picks it; a questionId in the body is not trusted.
  const question = await Question.findOne({ order: orderForWeek(week) }).lean();
  if (!question) return res.status(404).json({ error: { message: 'No question for this week yet' } });

  // userId comes only from the header. A userId in the body is ignored.
  const filter = { userId: me(req).id, commitmentId, week };
  const update = { $set: { text: text.trim(), hardDay: hardDay === true, questionId: question._id } };
  const options = { upsert: true, returnDocument: 'after', runValidators: true, includeResultMetadata: true };

  let result;
  try {
    result = await Entry.findOneAndUpdate(filter, update, options).lean();
  } catch (e) {
    if (e.code !== 11000) throw e;
    result = await Entry.findOneAndUpdate(filter, update, options).lean();   // lost a race with a twin save
  }
  const created = !result.lastErrorObject?.updatedExisting;
  const [entry] = await withQuestions([result.value]);
  res.status(created ? 201 : 200).json({ data: entry });
});

// 23. The caller's own entries for one commitment, in week order
router.get('/entries', async (req, res) => {
  const commitmentId = commitmentIdFrom(req.query.commitmentId);
  if (!commitmentId) return bad(res, 'commitmentId is needed');
  const entries = await Entry.find({ userId: me(req).id, commitmentId }).sort({ week: 1 }).lean();
  res.json({ data: await withQuestions(entries) });
});

// 24. Then and Now: the first entry beside the latest one
router.get('/then-and-now', async (req, res) => {
  const commitmentId = commitmentIdFrom(req.query.commitmentId);
  if (!commitmentId) return bad(res, 'commitmentId is needed');
  const entries = await Entry.find({ userId: me(req).id, commitmentId }).sort({ week: 1 }).lean();
  const picked = entries.length >= 2 ? [entries[0], entries[entries.length - 1]] : entries.slice(0, 1);
  const [first = null, latest = null] = await withQuestions(picked);
  res.json({ data: { first, latest } });
});

// 24g. A private voice note for one week: the bytes the browser recorded, kept as they are. No transcript is
// made, no model or speech service ever receives it; only the person who recorded it can play it back.
// Recording again in the same week replaces it.
router.post('/voice', async (req, res) => {
  const commitmentId = commitmentIdFrom(req.body?.commitmentId);
  const week = parseWeek(req.body?.week);
  const mimeType = typeof req.body?.mimeType === 'string' ? req.body.mimeType.trim().slice(0, 80) : '';
  const base64 = typeof req.body?.audioBase64 === 'string' ? req.body.audioBase64 : '';
  if (!commitmentId) return bad(res, 'commitmentId is needed');
  if (!week) return bad(res, 'Please give the week (1 or more)');
  if (!/^audio\/[\w.+-]+(;.*)?$/.test(mimeType)) return bad(res, 'The recording has no audio type');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return bad(res, 'The recording must be base64 audio');
  const audio = Buffer.from(base64, 'base64');
  if (!audio.length) return bad(res, 'The recording is empty');
  if (audio.length > VoiceNote.MAX_BYTES) return res.status(413).json({ error: { message: 'Please keep a voice note under a minute' } });
  const seconds = Number.isFinite(Number(req.body?.seconds)) ? Math.max(0, Math.round(Number(req.body.seconds))) : null;
  const filter = { userId: me(req).id, commitmentId, week };
  const result = await VoiceNote.findOneAndUpdate(filter, { $set: { mimeType, audio, seconds } },
    { upsert: true, returnDocument: 'after', includeResultMetadata: true });
  res.status(result.lastErrorObject?.updatedExisting ? 200 : 201).json({ data: { week, mimeType, seconds, bytes: audio.length } });
});

// 24h. Which weeks have a voice note (no audio in the list), and one note's audio. Only the owner's.
router.get('/voice', async (req, res) => {
  const commitmentId = commitmentIdFrom(req.query.commitmentId);
  if (!commitmentId) return bad(res, 'commitmentId is needed');
  const week = parseWeek(req.query.week);
  if (week) {
    const note = await VoiceNote.findOne({ userId: me(req).id, commitmentId, week }).lean();
    if (!note) return res.json({ data: null });
    return res.json({ data: { week, mimeType: note.mimeType, seconds: note.seconds, audioBase64: note.audio.toString('base64'), createdAt: note.createdAt } });
  }
  const list = await VoiceNote.find({ userId: me(req).id, commitmentId }).sort({ week: 1 }).select('week mimeType seconds createdAt').lean();
  res.json({ data: list.map(n => ({ week: n.week, mimeType: n.mimeType, seconds: n.seconds, createdAt: n.createdAt })) });
});

router.delete('/voice', async (req, res) => {
  const commitmentId = commitmentIdFrom(req.query.commitmentId);
  const week = parseWeek(req.query.week);
  if (!commitmentId || !week) return bad(res, 'commitmentId and week are needed');
  await VoiceNote.deleteOne({ userId: me(req).id, commitmentId, week });
  res.json({ data: { week, deleted: true } });
});

// 24f. My Seva so far, across every commitment: the first entry ever written beside the latest, and every
// sealed Sankalpa in the order they were sealed. Only the caller's own; no counts, no totals.
router.get('/my-seva', async (req, res) => {
  const userId = me(req).id;
  const [first] = await Entry.find({ userId }).sort({ createdAt: 1, week: 1 }).limit(1).lean();
  const [latest] = await Entry.find({ userId }).sort({ updatedAt: -1, week: -1 }).limit(1).lean();
  const picked = first && latest && String(first._id) !== String(latest._id) ? [first, latest] : first ? [first] : [];
  const [firstOut = null, latestOut = null] = await withQuestions(picked);
  const sankalpas = await Sankalpa.find({ userId }).sort({ sealedAt: 1 }).lean();
  const received = await Received.find({ userId }).sort({ writtenAt: 1 }).lean();
  res.json({
    data: {
      first: firstOut,
      latest: latestOut,
      sankalpas: sankalpas.map(x => ({ commitmentId: x.commitmentId, text: x.text, sealedAt: x.sealedAt })),
      received: received.map(x => ({ commitmentId: x.commitmentId, text: x.text, writtenAt: x.writtenAt })),
    },
  });
});

// 24b. Seal the Sankalpa: one private line, written once when she commits. A second write is refused.
router.post('/sankalpa', async (req, res) => {
  const commitmentId = commitmentIdFrom(req.body?.commitmentId);
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!commitmentId) return bad(res, 'commitmentId is needed');
  if (!text) return bad(res, 'Please write one line before sealing it');
  if (text.length > 300) return bad(res, 'Please keep it to one line (under 300 characters)');
  try {
    const s = await Sankalpa.create({ userId: me(req).id, commitmentId, text });
    res.status(201).json({ data: { text: s.text, sealedAt: s.sealedAt } });
  } catch (e) {
    if (e.code !== 11000) throw e;
    res.status(409).json({ error: { message: 'Your Sankalpa is already sealed' } });
  }
});

// 24c. Her own Sankalpa for one commitment, or null. Nobody else's, ever.
router.get('/sankalpa', async (req, res) => {
  const commitmentId = commitmentIdFrom(req.query.commitmentId);
  if (!commitmentId) return bad(res, 'commitmentId is needed');
  const s = await Sankalpa.findOne({ userId: me(req).id, commitmentId }).lean();
  res.json({ data: s ? { text: s.text, sealedAt: s.sealedAt } : null });
});

// 24d. "What did they give you?": written once at finish, before the handover. Private, like the Sankalpa.
router.post('/received', async (req, res) => {
  const commitmentId = commitmentIdFrom(req.body?.commitmentId);
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!commitmentId) return bad(res, 'commitmentId is needed');
  if (!text) return bad(res, 'Please write a few words first');
  if (text.length > 1000) return bad(res, 'Please keep it under 1000 characters');
  try {
    const r = await Received.create({ userId: me(req).id, commitmentId, text });
    res.status(201).json({ data: { text: r.text, writtenAt: r.writtenAt } });
  } catch (e) {
    if (e.code !== 11000) throw e;
    res.status(409).json({ error: { message: 'You have already written this' } });
  }
});

// 24e. Her own answer for one commitment, or null
router.get('/received', async (req, res) => {
  const commitmentId = commitmentIdFrom(req.query.commitmentId);
  if (!commitmentId) return bad(res, 'commitmentId is needed');
  const r = await Received.findOne({ userId: me(req).id, commitmentId }).lean();
  res.json({ data: r ? { text: r.text, writtenAt: r.writtenAt } : null });
});

module.exports = router;
