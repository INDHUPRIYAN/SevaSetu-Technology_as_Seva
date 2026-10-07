// VoiceBridge: the coordinator speaks or types naturally; the card builds live; the app asks only what is
// missing, one question at a time, at most three. Stateless: the browser sends every turn and the draft
// back each time, and nothing here is stored. The rules (../voicebridge.js) always run; with an LLM key the
// model does the understanding and words the question and read-back in the coordinator's language, but the
// server alone decides what is missing, caps the questions, and runs every string through the dignity rules.
// Nothing invalid is ever applied. AI never publishes: this answers with a draft, and a person publishes.
const express = require('express');
const vb = require('../voicebridge');
const { findFlags } = require('../dignity');
const { withTimeout } = require('./bridge');

const MAX_TEXT = 5000;
const MAX_TURNS = 12;
const fail = (res, status, message) => res.status(status).json({ error: { message } });
const str = v => (typeof v === 'string' ? v.trim() : '');
const isClean = s => findFlags(s).length === 0;

const { LANGUAGES: LANGUAGE_TABLE } = require('../languages');
const LANGUAGE_NAME = Object.fromEntries(Object.entries(LANGUAGE_TABLE).map(([code, l]) => [code, l.name]));

const EXTRACT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['draft', 'question', 'readBack'],
  properties: {
    draft: {
      type: 'object',
      additionalProperties: false,
      required: ['title', 'want', 'serveUsWell', 'youWillLearn', 'groupSize', 'interestTags', 'rhythm', 'weeks', 'place'],
      properties: {
        title: { type: 'string' },
        want: { type: 'string' },
        serveUsWell: { type: 'string' },
        youWillLearn: { type: 'string' },
        groupSize: { type: 'integer' },
        interestTags: { type: 'array', items: { type: 'string' } },
        rhythm: { type: 'object', additionalProperties: false, required: ['day', 'start', 'end'], properties: { day: { type: 'string' }, start: { type: 'string' }, end: { type: 'string' } } },
        weeks: { type: 'integer' },
        place: { type: 'string' },
      },
    },
    question: { type: 'string' },
    readBack: { type: 'string' },
  },
};

const EXTRACT_PROMPT = `You help a community coordinator describe a need for volunteers. You will get the current
draft card, the conversation so far (the coordinator's words and the app's questions), and the name of ONE field
the app will ask about next (or "none").
EVERY FIELD OF THE DRAFT IS WRITTEN IN ENGLISH. The coordinator may speak any Indian language: translate what they
said into plain English for the card (title, want, serveUsWell, youWillLearn, place). Never leave a card field in
another script; if a field of the current draft is not in English, rewrite it in English without changing its
meaning. Translate faithfully: do not summarise, improve or add. Update the draft ONLY with what the
coordinator actually said; keep every other field as it is. NEVER invent serveUsWell, youWillLearn or place:
if the coordinator has not said how to serve the group well, what a volunteer will learn, or the name of the
place, those fields stay "" and the app will ask.
If the latest words answer the app's question, put the answer in that field; if they also carry something else
(a place, how to serve well), put each part in its own field. If the latest words are a correction ("change
Wednesday to Thursday", "not Saturday, Thursday"), change only that one field. Describe the GROUP: never a
person's name, age, income, caste, religion or health detail, never the words poor, needy, beneficiary, donor or
case. Unknown text fields stay "", unknown numbers 0. rhythm.day is a full English weekday; rhythm.start and
rhythm.end are 24-hour "HH:MM"; weeks and groupSize are whole numbers (read number words in any language).
interestTags: 1 to 3 lowercase English words.
"question": "" (the app words its own questions).
"readBack": 2 to 4 short sentences in the coordinator's language reading the card back exactly as it stands
(say nothing that is not on the card; keep place names and times as written).`;

function voicebridgeRouter({ callJSON, aiTimeoutMs, llmConfigured, languageConfigured }) {
  const router = express.Router();

  // What the browser can expect: whether a model and a speech provider are set up. Logged-in users only.
  router.get('/capabilities', (req, res) => {
    if (!req.headers['x-user-id']) return fail(res, 401, 'Please log in');
    res.json({ data: { llm: Boolean(llmConfigured?.()), speech: Boolean(languageConfigured?.()) } });
  });

  router.post('/voicebridge', async (req, res) => {
    if (req.headers['x-user-role'] !== 'coordinator') return fail(res, 403, 'Coordinators only');
    const { language = 'en', turns, draft, context } = req.body || {};
    if (!vb.LANGUAGES.includes(language)) return fail(res, 400, 'Language must be one of ' + vb.LANGUAGES.join(', '));
    if (!Array.isArray(turns) || !turns.length) return fail(res, 400, 'Please say or type the need');
    if (turns.length > MAX_TURNS) return fail(res, 400, 'Please start again: this conversation is too long');
    const clean = turns.map(t => ({
      role: t?.role === 'app' ? 'app' : 'coordinator',
      text: str(t?.text).slice(0, MAX_TEXT),
      field: str(t?.field) || undefined,
      relatedCardId: str(t?.relatedCardId) || undefined,
    }));
    if (clean[clean.length - 1].role !== 'coordinator' || !clean[clean.length - 1].text) return fail(res, 400, 'Please say or type the need');
    const cards = Array.isArray(context?.recentCards) ? context.recentCards.slice(0, 5) : [];
    const input = { language, turns: clean, draft: draft && typeof draft === 'object' ? draft : null, context: { recentCards: cards } };

    // 1. the rules, always
    const rules = vb.converse(input);
    let out = { ...rules, edited: undefined, source: 'rules' };

    // 2. the model, if set up: it sees the dignity-cleaned turns only, and the server re-decides everything
    if (llmConfigured?.()) {
      try {
        const spoken = clean.map(t => (t.role === 'app'
          ? `App asked (${t.field || 'open'}): ${t.text}`
          : `Coordinator: ${vb.cleanDraft({ want: t.text }).want}`)).join('\n');
        const askFor = rules.question ? rules.question.field : 'none';
        // the model reads the latest turn itself, starting from the draft the browser sent back (not from the
        // rules' reading, which would anchor it); the rules then fill only what the model left blank
        const previous = vb.normalize(input.draft || vb.blank());
        const user = `Language: ${LANGUAGE_NAME[language]}\nField to ask next: ${askFor === 'related' ? 'none' : askFor}\n\nCurrent draft:\n${JSON.stringify(previous)}\n\nConversation:\n${spoken}`;
        const ai = await withTimeout(callJSON({ system: EXTRACT_PROMPT, user, name: 'voicebridge', schema: EXTRACT_SCHEMA }), aiTimeoutMs);
        // every word the rules flagged anywhere (the raw turns, the raw model draft) is taboo in the model's
        // own sentences: a bare name the rules cannot see alone ("Ravi needs help") is still kept out
        const raw = `${clean.map(t => t.text).join('\n')}\n${JSON.stringify(ai.draft)}`;
        const taboo = findFlags(raw).flatMap(f => f.match.split(/[^\p{L}\p{N}]+/u)).filter(w => w.length > 2 && /^\p{Lu}|^\d/u.test(w));
        const safe = text => isClean(text) && !taboo.some(w => new RegExp(`(^|[^\\p{L}\\p{N}])${w}([^\\p{L}\\p{N}]|$)`, 'u').test(text));
        const aiDraft = vb.cleanDraft(ai.draft);
        for (const k of ['title', 'want', 'serveUsWell', 'youWillLearn', 'place']) if (aiDraft[k] && !safe(aiDraft[k])) aiDraft[k] = rules.draft[k] || '';
        // the model may fill "how to serve well" and "what a volunteer will learn" only when that field was asked,
        // was already there, or the rules heard it too: an invented answer would silence a question that must be asked
        const lastAsked = clean.length >= 2 && clean[clean.length - 2].role === 'app' ? clean[clean.length - 2].field : null;
        // an answer to "how to serve well" that the model filed under "what a volunteer will learn" (or the other
        // way round) belongs to the field that was asked
        const pair = { serveUsWell: 'youWillLearn', youWillLearn: 'serveUsWell' };
        if (pair[lastAsked] && !aiDraft[lastAsked] && aiDraft[pair[lastAsked]] && !previous[pair[lastAsked]]) {
          aiDraft[lastAsked] = aiDraft[pair[lastAsked]];
          aiDraft[pair[lastAsked]] = '';
        }
        for (const k of ['serveUsWell', 'youWillLearn']) {
          const allowed = previous[k] || lastAsked === k || rules.draft[k];
          if (!allowed) aiDraft[k] = '';
          if (!aiDraft[k] && lastAsked === k && rules.draft[k]) aiDraft[k] = rules.draft[k];   // the answer, as said
        }
        // an explicit spoken edit the rules recognised ("not Saturday, Thursday") is an edit, not an answer:
        // start again from the previous draft and change only that one field, with the rules' value
        const edited = rules.edited;
        if (edited) {
          const before = JSON.parse(JSON.stringify(previous));
          if (edited === 'day') before.rhythm.day = rules.draft.rhythm.day;
          if (edited === 'start') { before.rhythm.start = rules.draft.rhythm.start; before.rhythm.end = rules.draft.rhythm.end || before.rhythm.end; }
          if (edited === 'weeks') before.weeks = rules.draft.weeks;
          if (edited === 'place') before.place = rules.draft.place;
          Object.assign(aiDraft, before);
        }
        // keep what the rules found that the model dropped (a title, a time, a day, the weeks)
        for (const k of ['title', 'want', 'place']) if (!aiDraft[k] && rules.draft[k]) aiDraft[k] = rules.draft[k];
        for (const k of ['day', 'start', 'end']) if (!aiDraft.rhythm[k] && rules.draft.rhythm[k]) aiDraft.rhythm[k] = rules.draft.rhythm[k];
        if (!aiDraft.weeks) aiDraft.weeks = rules.draft.weeks;
        if (!aiDraft.groupSize) aiDraft.groupSize = rules.draft.groupSize;
        if (!aiDraft.interestTags.length) aiDraft.interestTags = rules.draft.interestTags;
        const decided = vb.decide({ ...input, draft: aiDraft });
        // the question is always the fixed wording for that field in the coordinator's language: a model's
        // own wording can drift to the wrong field. The model's read-back is used when it is clean.
        const readBack = str(ai.readBack) && safe(ai.readBack) ? str(ai.readBack) : decided.readBack;
        out = { ...decided, edited: undefined, readBack, source: 'ai' };
      } catch (e) {
        if (process.env.LLM_DEBUG) console.error('voicebridge: model answer not used:', e.message);   // never the words themselves
      }
    }

    res.json({ data: out });
  });

  return router;
}

module.exports = { voicebridgeRouter, EXTRACT_SCHEMA };
