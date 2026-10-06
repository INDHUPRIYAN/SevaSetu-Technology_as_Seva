// The data seed-reflect.js writes into seva_reflect. Change words here, not in the script.
// All names anywhere in the seed are invented. Nothing here names a child or a parent.

// Teachings for the Wisdom page and "Seva Wisdom for Today": seed/wisdom.json. Every text is copied
// verbatim from The Complete Works of Swami Vivekananda (`url` is an online copy). `verified` stays false
// until a person has found the quote in a printed volume and added the `page`; the app shows only
// verified quotes, here and in the whys and moments below. `url` is not stored in the database.
const WISDOM = require('./wisdom.json');

// Reuse a verified quote by its opening words, so a quote is written down in one place only.
function quote(start) {
  const w = WISDOM.find(x => x.text.startsWith(start));
  if (!w) throw new Error(`reflect-data: no verified quote starts with "${start}"`);
  return { quote: w.text, source: w.source };
}

// The five diary questions (plan section 4). Week N uses order ((N - 1) % 5) + 1.
// `teaching` is a short line of our own under the question, not a quotation.
const QUESTIONS = [
  { order: 1, theme: 'patience', text: 'When did you have to wait today?', teaching: 'Patience and perseverance' },
  { order: 2, theme: 'listening', text: 'What did someone tell you that surprised you?', teaching: 'Feel first, organize afterwards' },
  { order: 3, theme: 'effort', text: 'What was in your hands today, and what was not?', teaching: 'Work fully, leave the results' },
  { order: 4, theme: 'received', text: 'What did you receive today?', teaching: 'The giver receives more than the receiver' },
  // the humility check: private, never scored, like every other entry
  { order: 5, theme: 'pride', text: 'Was there a moment this week I felt I knew better than them?', teaching: 'Help offered from above is not seva' },
];

// The "Why?" behind each rule: verified teaching (or none) → our interpretation → the product decision.
// Where no verified quote honestly fits, the teaching is left empty rather than stretched.
const WHYS = [
  {
    ruleKey: 'listen-first',
    title: 'Why listen first?',
    ...quote('Three things are necessary'),
    interpretation: 'Before deciding how to help, feel what the community feels and hear what it wants. '
      + 'We sum this up as "feel first, organize afterwards" — that line is our paraphrase, not his words. '
      + 'Help that begins with listening respects the people it is for.',
    decision: 'SevaSetu has no "Register" button. You visit once, only to listen, and write down what '
      + 'surprised you. Nobody commits until you and the community have both said yes.',
  },
  {
    ruleKey: 'no-hours',
    title: "Why don't we count time?",
    ...quote('Purity, patience, and perseverance'),
    interpretation: 'Seva that changes something is slow and steady. What matters is that you came back, '
      + 'week after week, and gave your full attention while you were there — not how long you stayed.',
    decision: 'Progress is only "Week 2 of 4". We mark the weeks you kept, and never log time.',
  },
  {
    ruleKey: 'no-ranks',
    title: 'Why no leaderboard?',
    ...quote('There are some who are really the salt'),
    interpretation: 'The people he admired worked for the work itself, not for name or fame. A list that '
      + 'puts volunteers above one another turns seva into a contest for exactly that.',
    decision: 'There is no leaderboard, no badges, no streaks and no "best volunteer". '
      + 'SevaSetu never compares one volunteer with another.',
  },
  {
    ruleKey: 'no-photos',
    title: 'Why no photos?',
    ...quote('You cannot help anyone'),
    interpretation: 'Serving is a privilege given to us, not help handed down to someone lower. The children '
      + 'and families we meet are our hosts. A photo taken in a moment of help can follow a child for years, '
      + 'and turns people into content.',
    decision: 'SevaSetu stores and shows no photos, names, ages, family finances, caste, religion or health details '
      + 'of the people served. The guest briefing asks volunteers not to take photos.',
  },
  {
    ruleKey: 'private-diary',
    title: 'Why is the diary private?',
    ...quote('Seek no praise'),
    interpretation: 'A diary written to be seen soon becomes a way of asking for credit. Written only for '
      + 'yourself, it can stay honest, and show you how you are changing.',
    decision: 'Only the writer can read their Seva Diary — not their circle, not the coordinator. '
      + 'No AI reads it, and nothing in it is scored, rated or summarised.',
  },
  {
    ruleKey: 'community-confirmation',
    title: 'Why must the community confirm?',
    ...quote('Liberty is the first condition'),
    interpretation: 'In this lecture he warns against anyone who claims to work out another person\'s '
      + 'salvation for them. A need belongs to the community that has it: a card written about them, even '
      + 'with good intent, can say something they never said. Reading it back gives them the last word.',
    decision: 'AI only drafts. The coordinator edits the card, reads it back to the community, and can '
      + 'publish only after the community confirms and the coordinator gives consent.',
  },
];

// Teachings shown in context: verified teaching → our interpretation → one practical action.
const MOMENTS = [
  {
    key: 'before-listen',
    title: 'Before you visit',
    ...quote('Three things are necessary'),
    interpretation: 'Feel first, organize afterwards. Go to understand how things look from their side '
      + 'before you think about what you could do.',
    practice: 'On this visit, ask more than you tell. Afterwards, write down one thing that surprised you.',
  },
  {
    key: 'commit',
    title: 'Before you commit',
    ...quote('Let us work on'),
    interpretation: 'A commitment is a duty you choose freely, and keep quietly, week after week.',
    practice: 'Pick a day and time you can truly keep for four weeks. If a week fails, tell your circle early.',
  },
  {
    key: 'hard-day',
    title: 'After a hard day',
    ...quote('Purity, patience, and perseverance'),
    interpretation: 'A hard day is not a failed day. Change in a classroom or a community is slow, and '
      + 'sincere effort counts even when the result cannot be seen yet.',
    practice: 'Note what was in your hands, let go of what was not, and come back next week.',
  },
  {
    key: 'continue',
    title: 'Seva as a practice',
    ...quote('…they alone live'),
    interpretation: 'Seva is a practice kept over time, not a single visit. Continuing, pausing and '
      + 'finishing well are all part of it.',
    practice: 'Continue only if you can keep the rhythm. If you pause or finish, leave a handover so the '
      + 'next person can begin where you stopped.',
  },

  // Non-attachment moments: plain words of our own, no quotation. Each is a calm full screen with one
  // next action. No apology, no retry pressure.
  {
    key: 'declined',
    title: 'Not this time',
    interpretation: 'Listening was the seva. The answer was theirs to give, and they gave it. '
      + 'Nothing you did there is undone by it.',
    practice: 'Carry what you heard with you. Another community may be waiting for exactly that.',
  },
  {
    key: 'closed',
    title: 'This seva is complete',
    interpretation: 'The need has ended: a school has closed, an organisation has moved on, a season is over. '
      + 'Work done with full attention is complete when it ends, whether or not it ended on your terms.',
    practice: 'Keep the rhythm you learned. When you are ready, find the next place that needs it.',
  },
  {
    key: 'finished',
    title: 'Before you go',
    interpretation: 'The one you served gave you the chance to serve. That gift came first, '
      + 'before anything you brought.',
    practice: 'Write down what they gave you. Only then, write what you leave for the next volunteer.',
  },
];

// Seeded volunteer, week 1 only. Week 2 is written live in the demo.
const SEEDED_ENTRY = { week: 1, text: 'I kept correcting them.', hardDay: false };

// The seeded volunteer's sealed Sankalpa, written when he committed. Shown again only to him.
const SEEDED_SANKALPA = 'To wait for someone else to find their words.';

module.exports = { QUESTIONS, WHYS, MOMENTS, WISDOM, SEEDED_ENTRY, SEEDED_SANKALPA };
