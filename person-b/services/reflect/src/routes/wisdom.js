// Endpoints 25–27: Swamiji's teachings, and the "Why?" behind each rule of the app.
const router = require('express').Router();
const Wisdom = require('../models/Wisdom');
const Why = require('../models/Why');
const { dayOfYear } = require('../dayOfYear');

const publicWisdom = w => ({ _id: w._id, theme: w.theme, text: w.text, source: w.source });

// 25. Same quote all day: dayOfYear % count
router.get('/today', async (req, res) => {
  const count = await Wisdom.countDocuments();
  if (!count) return res.status(404).json({ error: { message: 'No wisdom yet' } });
  const day = dayOfYear(req.app.locals.now(), req.app.locals.timeZone);
  const [wisdom] = await Wisdom.find().sort({ _id: 1 }).skip(day % count).limit(1).lean();
  res.json({ data: publicWisdom(wisdom) });
});

// 27. One "Why?" teaching. Unknown key → 404
router.get('/why/:ruleKey', async (req, res) => {
  const why = await Why.findOne({ ruleKey: String(req.params.ruleKey) }).lean();
  if (!why) return res.status(404).json({ error: { message: 'No teaching for this rule' } });
  res.json({ data: { ruleKey: why.ruleKey, title: why.title, teaching: why.teaching } });
});

// 26. All wisdom, or one theme
router.get('/', async (req, res) => {
  const theme = typeof req.query.theme === 'string' ? req.query.theme.trim().toLowerCase() : '';
  const list = await Wisdom.find(theme ? { theme } : {}).sort({ _id: 1 }).lean();
  res.json({ data: list.map(publicWisdom) });
});

module.exports = router;
