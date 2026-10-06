// Endpoints 21–24: the private Seva Diary. Every entries query is filtered by the caller's own id.
const router = require('express').Router();
const Question = require('../models/Question');
const Entry = require('../models/Entry');
const { me } = require('../user');

const QUESTION_COUNT = 4;                        // the four diary questions rotate week by week
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

module.exports = router;
