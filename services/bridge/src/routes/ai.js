// The small AI jobs. Each one has a fallback that needs no AI, answers within the timeout, and only
// suggests: a person accepts, edits or rejects every result. Diary entries are never sent here.
const express = require('express');
const { findFlags, ruleRewrite, publicFlag } = require('../dignity');
const { ruleMatch } = require('../teachings');
const { withTimeout } = require('./bridge');

const MAX_TEXT = 5000;
const KINDS = ['name', 'money', 'caste or religion', 'health', 'age', 'word we avoid'];

const fail = (res, status, message) => res.status(status).json({ error: { message } });
const text = v => (typeof v === 'string' ? v.trim() : '');
const isClean = s => findFlags(s).length === 0;

const DIGNITY_PROMPT = `You check words that will appear on a public card about a community group, for dignity.
Flag every exact substring (copy it character for character from the text) that names or identifies one
person, gives a person's age, mentions money or income, caste, religion or a health detail, or uses the
words poor, needy, beneficiary, donor or case (about people). Give each a one-line reason in plain English.
Then rewrite the whole text in the same language so that it describes the group, never one person, and
leaves those details out, keeping everything else. If nothing needs changing, return no flags and an empty rewrite.`;

const DIGNITY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['flags', 'rewrite'],
  properties: {
    flags: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['match', 'kind', 'why'],
        properties: { match: { type: 'string' }, kind: { type: 'string', enum: KINDS }, why: { type: 'string' } },
      },
    },
    rewrite: { type: 'string' },
  },
};

const GUIDE_PROMPT = `A volunteer will visit a community group once, only to listen, before anyone commits to anything.
Write exactly 3 open questions the volunteer can ask the group. Each question invites the group to speak
about what they want and how they see things. Make no assumptions about the group: no guesses about what
they lack or feel, no yes/no questions, no advice. Never ask about one person, money, caste, religion or
health. Plain, warm English, under 20 words each, each ending with "?".`;

const GUIDE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['questions'],
  properties: { questions: { type: 'array', items: { type: 'string' } } },
};

// A question that carries an assumption about the group is not an open question
const ASSUMES = /\b(really|actually|truly)\s+(need|want|lack)s?\b|\bthey\s+(lack|are\s+(poor|needy|helpless|backward))\b|\bwhy\s+(don't|do\s+not|can't|cannot)\s+(you|they)\b|\bshould(n't| not)?\s+(you|they)\b/i;

// Used when the AI is off or its answer does not pass the checks
const FALLBACK_QUESTIONS = [
  'What would you like a volunteer to know before they begin?',
  'What has helped the group most so far, and what has not?',
  'What would a good session together look like to you?',
];

const UPDATE_PROMPT = `A volunteer visited a community group once, only to listen, and wrote what they heard.
Suggest at most ONE short line (under 25 words) to add to the group's need card, under "Updated after
listening", if what they heard should change how volunteers serve this group. Describe the group, never one
person. No names, ages, money, caste, religion or health details. Plain English. If nothing on the card
should change, return an empty line.`;

const UPDATE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['line'],
  properties: { line: { type: 'string' } },
};

const FIND_PROMPT = `Someone describes a situation from their seva. From the numbered teachings below, pick the
ONE whose meaning speaks most closely to that situation. Answer with its id only. If none fits, answer "".
Do not write, change or explain any teaching.`;

const FIND_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: { id: { type: 'string' } },
};

function cardText(card = {}) {
  const c = card && typeof card === 'object' ? card : {};
  return ['title', 'want', 'serveUsWell', 'youWillLearn', 'place']
    .map(k => (text(c[k]) ? `${k}: ${text(c[k])}` : ''))
    .filter(Boolean)
    .join('\n');
}

// Cut at a word boundary so a suggestion never ends mid-word
function clip(s, max) {
  if (s.length <= max) return s;
  return `${s.slice(0, max).replace(/\s+\S*$/, '')}…`;
}

function aiRouter({ callJSON, aiTimeoutMs, loadWisdom }) {
  const router = express.Router();
  const ask = (job, user) => withTimeout(callJSON({ ...job, user }), aiTimeoutMs);

  // Dignity Check: flags with a one-line reason each, and a respectful rewrite. Coordinators only.
  router.post('/dignity-check', async (req, res) => {
    if (req.headers['x-user-role'] !== 'coordinator') return fail(res, 403, 'Coordinators only');
    const value = typeof req.body?.text === 'string' ? req.body.text : '';
    if (!value.trim()) return fail(res, 400, 'Please send the words to check');
    if (value.length > MAX_TEXT) return fail(res, 400, `Please keep it under ${MAX_TEXT} characters`);

    const ruleFlags = findFlags(value);
    const flags = ruleFlags.map(publicFlag);
    let suggestedRewrite = ruleRewrite(value, ruleFlags);
    let source = 'rules';
    try {
      const ai = await ask({ system: DIGNITY_PROMPT, name: 'dignity_check', schema: DIGNITY_SCHEMA }, value);
      // keep what the AI found that the rules missed (a name in Tamil, say), if it is really in the text
      for (const f of Array.isArray(ai.flags) ? ai.flags : []) {
        const match = text(f.match);
        const start = match ? value.indexOf(match) : -1;
        if (start < 0) continue;
        const end = start + match.length;
        if (flags.some(x => start < x.end && end > x.start)) continue;
        flags.push({ start, end, match, kind: KINDS.includes(f.kind) ? f.kind : 'name', why: text(f.why) || 'Please check this before publishing.' });
      }
      flags.sort((a, b) => a.start - b.start);
      const rewrite = text(ai.rewrite);
      if (flags.length && rewrite && isClean(rewrite)) { suggestedRewrite = rewrite; source = 'ai'; }
    } catch (e) { /* the rules alone */ }

    res.json({ data: { flags, suggestedRewrite: flags.length ? suggestedRewrite : null, source } });
  });

  // Listening Guide: 3 open questions for the listening visit. Any logged-in user.
  router.post('/listening-guide', async (req, res) => {
    if (!req.headers['x-user-id']) return fail(res, 401, 'Please log in');
    const card = cardText(req.body);
    if (!card) return fail(res, 400, 'Please send the need card');

    let questions = FALLBACK_QUESTIONS;
    let source = 'fallback';
    try {
      const ai = await ask({ system: GUIDE_PROMPT, name: 'listening_guide', schema: GUIDE_SCHEMA }, card);
      const good = (Array.isArray(ai.questions) ? ai.questions : [])
        .map(text)
        .filter(q => q.length >= 10 && q.length <= 160 && q.endsWith('?') && isClean(q) && !ASSUMES.test(q));
      if (good.length >= 3) { questions = good.slice(0, 3); source = 'ai'; }
    } catch (e) { /* the three fixed questions */ }

    res.json({ data: { questions, source } });
  });

  // Updated after listening: one suggested line for the need card, or null. Coordinators only.
  // The volunteer's words go through the dignity rules first; flagged words never reach the model.
  router.post('/suggest-update', async (req, res) => {
    if (req.headers['x-user-role'] !== 'coordinator') return fail(res, 403, 'Coordinators only');
    const heard = text(req.body?.heardText);
    if (!heard) return fail(res, 400, 'Please send what the volunteer heard');
    if (heard.length > MAX_TEXT) return fail(res, 400, `Please keep it under ${MAX_TEXT} characters`);

    const flags = findFlags(heard);
    const safeHeard = flags.length ? (ruleRewrite(heard, flags) || '') : heard;

    let suggestion = safeHeard ? clip(`What a volunteer heard: ${safeHeard}`, 200) : null;
    let source = 'fallback';
    try {
      const ai = await ask(
        { system: UPDATE_PROMPT, name: 'listening_update', schema: UPDATE_SCHEMA },
        `Need card:\n${cardText(req.body?.needCard)}\n\nWhat the volunteer heard:\n${safeHeard}`,
      );
      const line = text(ai.line);
      if (!line) { suggestion = null; source = 'ai'; }
      else if (isClean(line)) { suggestion = clip(line, 200); source = 'ai'; }
    } catch (e) { /* the volunteer's own (checked) words */ }

    res.json({ data: { suggestion, source } });
  });

  // Teaching Finder: the id of the closest verified teaching, or null. Never any text of the model's own.
  router.post('/find-teaching', async (req, res) => {
    if (!req.headers['x-user-id']) return fail(res, 401, 'Please log in');
    const situation = text(req.body?.situation);
    if (!situation) return fail(res, 400, 'Please describe the situation');
    if (situation.length > 1000) return fail(res, 400, 'Please keep it under 1000 characters');

    const items = loadWisdom();
    const ids = new Set(items.map(w => w.id));
    let id = ruleMatch(situation, items);
    let source = 'rules';
    if (items.length) {
      try {
        const list = items.map(w => `${w.id}: ${w.text}`).join('\n');
        const ai = await ask({ system: FIND_PROMPT, name: 'find_teaching', schema: FIND_SCHEMA }, `Teachings:\n${list}\n\nSituation:\n${situation}`);
        const picked = text(ai.id);
        if (picked === '') { id = null; source = 'ai'; }
        else if (ids.has(picked)) { id = picked; source = 'ai'; }
      } catch (e) { /* the word match */ }
    }
    res.json({ data: { id: ids.has(id) ? id : null, source } });
  });

  return router;
}

module.exports = { aiRouter, FALLBACK_QUESTIONS };
