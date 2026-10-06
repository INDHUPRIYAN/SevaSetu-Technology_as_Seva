// The data seed-reflect.js writes into seva_reflect. Change words here, not in the script.
// All names anywhere in the seed are invented. Nothing here names a child or a parent.

// The four diary questions (plan section 4). Week N uses order ((N - 1) % 4) + 1.
const QUESTIONS = [
  { order: 1, theme: 'patience', text: 'When did you have to wait today?', teaching: 'Patience and perseverance' },
  { order: 2, theme: 'listening', text: 'What did someone tell you that surprised you?', teaching: 'Feel first, organize afterwards' },
  { order: 3, theme: 'effort', text: 'What was in your hands today, and what was not?', teaching: 'Work fully, leave the results' },
  { order: 4, theme: 'received', text: 'What did you receive today?', teaching: 'The giver receives more than the receiver' },
];

// The "Why?" behind each rule. These are our own words explaining the app, not quotes.
const WHYS = [
  {
    ruleKey: 'no-ranks',
    title: 'Why no leaderboard?',
    teaching: 'Seva is not a race. A list of names from first to last turns service into a contest, and the '
      + 'people we serve into a way to win it. Swamiji asked us to work without wanting name or fame, so '
      + 'SevaSetu never compares one volunteer with another.',
  },
  {
    ruleKey: 'no-photos',
    title: 'Why no photos?',
    teaching: 'The children and families we meet are our hosts, not a story for our feed. A photo taken '
      + 'in a moment of help can follow a child for years. We keep their dignity by keeping their faces '
      + 'and names out of the app. Remember the people, not the picture.',
  },
  {
    ruleKey: 'no-hours',
    title: "Why don't we count time?",
    teaching: 'Counting minutes makes service feel like a bill to be paid. What matters is that you came '
      + 'back, week after week, and gave your full attention while you were there. So we only mark the '
      + 'weeks you showed up. Work fully, and leave the results.',
  },
  {
    ruleKey: 'listen-first',
    title: 'Why listen first?',
    teaching: 'The community knows its own need better than any visitor. Before you agree to serve, you '
      + 'visit once and only listen. Feel first, organize afterwards. Help that begins with listening is '
      + 'help that respects the people it is for.',
  },
];

// Teachings for the Wisdom page and "Seva Wisdom for Today".
// RULE (plan section 7): copy every quote from the Complete Works of Swami Vivekananda and put the
// volume and page in `source`. Set `checked: true` only after a person has looked it up in the book.
// `checked` is not stored in the database; the seed script and test D5 use it to warn you.
const WISDOM = require('./wisdom-quotes');

// Seeded volunteer, week 1 only. Week 2 is written live in the demo.
const SEEDED_ENTRY = { week: 1, text: 'I kept correcting them.', hardDay: false };

module.exports = { QUESTIONS, WHYS, WISDOM, SEEDED_ENTRY };
