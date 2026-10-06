// Endpoints 25–27: Swamiji's teachings, the "Why?" behind each rule of the app, and teachings shown
// in context. Quotes and our own words are always returned in separate fields.
const router = require('express').Router();
const Wisdom = require('../models/Wisdom');
const Why = require('../models/Why');
const Moment = require('../models/Moment');
const { dayOfYear } = require('../dayOfYear');

const publicWisdom = w => ({
  _id: w._id, theme: w.theme, text: w.text, source: w.source, volume: w.volume ?? null, page: w.page ?? null,
});

// 25. Same quote all day: dayOfYear % count
router.get('/today', async (req, res) => {
  const count = await Wisdom.countDocuments();
  if (!count) return res.status(404).json({ error: { message: 'No wisdom yet' } });
  const day = dayOfYear(req.app.locals.now(), req.app.locals.timeZone);
  const [wisdom] = await Wisdom.find().sort({ _id: 1 }).skip(day % count).limit(1).lean();
  res.json({ data: publicWisdom(wisdom) });
});

// 27. One "Why?": teaching (or null) → interpretation → product decision. Unknown key → 404
router.get('/why/:ruleKey', async (req, res) => {
  const why = await Why.findOne({ ruleKey: String(req.params.ruleKey) }).lean();
  if (!why) return res.status(404).json({ error: { message: 'No teaching for this rule' } });
  res.json({
    data: {
      ruleKey: why.ruleKey,
      title: why.title,
      teaching: why.quote ? { quote: why.quote, source: why.source } : null,
      interpretation: why.interpretation,
      decision: why.decision,
    },
  });
});

// 27b. A teaching for one moment of the journey: teaching → interpretation → practice
router.get('/moment/:key', async (req, res) => {
  const m = await Moment.findOne({ key: String(req.params.key) }).lean();
  if (!m) return res.status(404).json({ error: { message: 'No teaching for this moment' } });
  res.json({
    data: {
      key: m.key,
      title: m.title,
      teaching: { quote: m.quote, source: m.source },
      interpretation: m.interpretation,
      practice: m.practice,
    },
  });
});

// 26. All wisdom, or one theme
router.get('/', async (req, res) => {
  const theme = typeof req.query.theme === 'string' ? req.query.theme.trim().toLowerCase() : '';
  const list = await Wisdom.find(theme ? { theme } : {}).sort({ _id: 1 }).lean();
  res.json({ data: list.map(publicWisdom) });
});

module.exports = router;
