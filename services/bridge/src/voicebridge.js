// VoiceBridge, the rule-based half. The coordinator speaks or types; these rules read what was said into the
// need card, decide what is still missing, ask ONE question at a time (at most 3), apply spoken edits such
// as "change Wednesday to Thursday", and write the read-back. They run with no AI key at all; with a key,
// the model does the understanding and these rules still decide what is missing and cap the questions.
// Nothing here stores anything: the browser holds the turns, the server answers from them.
const { findFlags, ruleRewrite, publicFlag } = require('./dignity');
const { normalizeDraft } = require('./draft');

const LANGUAGES = ['en', 'ta', 'hi'];
const MAX_QUESTIONS = 3;

// Required, in the order they are asked. youWillLearn is asked once, only if a question is left.
const REQUIRED = ['want', 'place', 'day', 'start', 'weeks', 'serveUsWell'];
const OPTIONAL = ['youWillLearn'];

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_WORDS = {
  Monday: ['monday', 'mon', 'திங்கள்', 'திங்கட்கிழமை', 'सोमवार'],
  Tuesday: ['tuesday', 'tue', 'tues', 'செவ்வாய்', 'செவ்வாய்க்கிழமை', 'मंगलवार'],
  Wednesday: ['wednesday', 'wed', 'புதன்', 'புதன்கிழமை', 'बुधवार'],
  Thursday: ['thursday', 'thu', 'thurs', 'வியாழன்', 'வியாழக்கிழமை', 'गुरुवार', 'बृहस्पतिवार'],
  Friday: ['friday', 'fri', 'வெள்ளி', 'வெள்ளிக்கிழமை', 'शुक्रवार'],
  Saturday: ['saturday', 'sat', 'சனி', 'சனிக்கிழமை', 'शनिवार'],
  Sunday: ['sunday', 'sun', 'ஞாயிறு', 'ஞாயிற்றுக்கிழமை', 'रविवार'],
};
const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12,
  ஒரு: 1, இரண்டு: 2, மூன்று: 3, நான்கு: 4, ஐந்து: 5, ஆறு: 6, எட்டு: 8, பத்து: 10, பன்னிரண்டு: 12,
  एक: 1, दो: 2, तीन: 3, चार: 4, पांच: 5, पाँच: 5, छह: 6, आठ: 8, दस: 10, बारह: 12,
};
const INTERESTS = {
  reading: /\b(read|reading|stories|story|books?|library)\b|படி|வாசி|कहानी|पढ़/i,
  english: /\benglish\b|ஆங்கில|अंग्रेज़ी|अंग्रेजी/i,
  maths: /\b(maths?|mathematics|numbers?|counting)\b|கணக்கு|गणित/i,
  gardening: /\b(garden|gardening|plants?|trees?)\b|தோட்ட|बगीचा|पौध/i,
  art: /\b(art|drawing|painting|craft)\b|ஓவிய|कला|चित्र/i,
  music: /\b(music|songs?|singing)\b|பாட்டு|இசை|संगीत|गाना/i,
  conversation: /\b(conversation|talk|talking|speak|speaking|listening)\b|பேச|बात/i,
  games: /\b(games?|play|sports?)\b|விளையாட்டு|खेल/i,
};
const YES = /^\s*(yes|yeah|yep|ok|okay|ஆம்|ஆமாம்|சரி|हाँ|हां|जी|ठीक)\b/i;
const NO = /^\s*(no|nope|not|இல்லை|வேண்டாம்|नहीं|ना)\b/i;

const QUESTIONS = {
  en: {
    want: 'What does the group want help with?',
    place: 'Where will this happen? Please name the place.',
    day: 'Which day of the week?',
    start: 'What time does it start, and until when?',
    weeks: 'For how many weeks?',
    serveUsWell: 'How can a volunteer serve the group well?',
    youWillLearn: 'What will a volunteer learn here?',
    related: 'Is this for the same place as "{title}"?',
  },
  ta: {
    want: 'குழுவிற்கு எதில் உதவி வேண்டும்?',
    place: 'இது எங்கே நடக்கும்? இடத்தின் பெயரைச் சொல்லுங்கள்.',
    day: 'வாரத்தில் எந்த நாள்?',
    start: 'எத்தனை மணிக்குத் தொடங்கும், எத்தனை மணி வரை?',
    weeks: 'எத்தனை வாரங்களுக்கு?',
    serveUsWell: 'ஒரு தன்னார்வலர் குழுவிற்கு எப்படி நன்றாகச் சேவை செய்யலாம்?',
    youWillLearn: 'ஒரு தன்னார்வலர் இங்கே என்ன கற்றுக்கொள்வார்?',
    related: 'இது "{title}" அதே இடத்திற்கா?',
  },
  hi: {
    want: 'समूह को किस चीज़ में मदद चाहिए?',
    place: 'यह कहाँ होगा? कृपया जगह का नाम बताइए।',
    day: 'हफ़्ते का कौन सा दिन?',
    start: 'कितने बजे शुरू होगा, और कब तक?',
    weeks: 'कितने हफ़्तों के लिए?',
    serveUsWell: 'एक स्वयंसेवक समूह की अच्छी सेवा कैसे कर सकता है?',
    youWillLearn: 'एक स्वयंसेवक यहाँ क्या सीखेगा?',
    related: 'क्या यह "{title}" वाली जगह के लिए ही है?',
  },
};

// Read-back scaffolding per language; the card's own words are kept as written (English, or the coordinator's).
const READ_BACK = {
  en: d => [
    d.title && `Need: ${d.title}.`,
    d.want && `${d.want}`,
    d.place && `Place: ${d.place}.`,
    d.rhythm.day && `Every ${d.rhythm.day}${d.rhythm.start ? ` from ${d.rhythm.start}` : ''}${d.rhythm.end ? ` to ${d.rhythm.end}` : ''}${d.weeks ? `, for ${d.weeks} weeks` : ''}.`,
    d.serveUsWell && `How to serve the group well: ${d.serveUsWell}`,
    d.youWillLearn && `A volunteer will learn: ${d.youWillLearn}`,
  ],
  ta: d => [
    d.title && `தேவை: ${d.title}.`,
    d.want && `${d.want}`,
    d.place && `இடம்: ${d.place}.`,
    d.rhythm.day && `ஒவ்வொரு ${dayIn('ta', d.rhythm.day)}${d.rhythm.start ? ` ${d.rhythm.start} முதல்` : ''}${d.rhythm.end ? ` ${d.rhythm.end} வரை` : ''}${d.weeks ? `, ${d.weeks} வாரங்களுக்கு` : ''}.`,
    d.serveUsWell && `குழுவிற்கு நன்றாகச் சேவை செய்வது எப்படி: ${d.serveUsWell}`,
    d.youWillLearn && `தன்னார்வலர் கற்றுக்கொள்வது: ${d.youWillLearn}`,
  ],
  hi: d => [
    d.title && `ज़रूरत: ${d.title}.`,
    d.want && `${d.want}`,
    d.place && `जगह: ${d.place}.`,
    d.rhythm.day && `हर ${dayIn('hi', d.rhythm.day)}${d.rhythm.start ? ` ${d.rhythm.start} से` : ''}${d.rhythm.end ? ` ${d.rhythm.end} तक` : ''}${d.weeks ? `, ${d.weeks} हफ़्तों के लिए` : ''}.`,
    d.serveUsWell && `समूह की अच्छी सेवा कैसे करें: ${d.serveUsWell}`,
    d.youWillLearn && `एक स्वयंसेवक सीखेगा: ${d.youWillLearn}`,
  ],
};
function dayIn(language, day) {
  const words = DAY_WORDS[day] || [];
  if (language === 'ta') return words.find(w => /[஀-௿]/.test(w) && w.endsWith('கிழமை')) || day;
  if (language === 'hi') return words.find(w => /[ऀ-ॿ]/.test(w)) || day;
  return day;
}

const str = v => (typeof v === 'string' ? v.trim() : '');
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function findDays(text) {
  const found = [];
  for (const day of WEEKDAYS) {
    for (const w of DAY_WORDS[day]) {
      const re = /^[a-z]+$/.test(w) ? new RegExp(`\\b${w}\\b`, 'i') : new RegExp(esc(w));
      const m = re.exec(text);
      if (m) { found.push({ day, at: m.index }); break; }
    }
  }
  return found.sort((a, b) => a.at - b.at).map(x => x.day);
}

// "10", "10 am", "10:30", "4 pm", "10 மணி", "सुबह 10 बजे" → "HH:MM". Morning/evening words settle am/pm.
function toClock(h, m, suffix, context) {
  let hour = Number(h);
  const min = m ? Number(m) : 0;
  const pm = /p/i.test(suffix || '') || /\b(evening|afternoon|மாலை|மதியம்|शाम|दोपहर)\b/.test(context);
  const am = /a/i.test(suffix || '') || /\b(morning|காலை|सुबह)\b/.test(context);
  if (pm && hour < 12) hour += 12;
  if (am && hour === 12) hour = 0;
  if (!pm && !am && hour >= 1 && hour <= 6) hour += 12;      // "4 to 6" with no am/pm: afternoon
  if (hour > 23 || min > 59) return '';
  return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}
const TIME = String.raw`(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?|மணி|बजे)?`;
const TO = String.raw`\s*(?:to|-|–|till|until|முதல்|வரை|से|तक)\s*`;
const withSuffix = s => /[ap]|மணி|बजे/i.test(s || '');
function findTimes(text) {
  // "class 6 to 8", "std 5-7", "4 weeks", "12 students" are not times
  const t = text
    .replace(/\b(?:class(?:es)?|std|grade|standard)\s*\d{1,2}(?:\s*(?:to|-|–)\s*\d{1,2})?/gi, ' ')
    .replace(/\b\d{1,3}\s*(?:weeks?|வாரம்|வாரங்கள்|வாரங்களுக்கு|हफ़्त\S*|हफ्त\S*|सप्ताह|students?|children|kids|people|elders|boys|girls|மாணவர்\S*|குழந்தை\S*|பேர்|बच्च\S*|छात्र\S*|लोग)/gi, ' ');
  const range = new RegExp(`${TIME}${TO}${TIME}`, 'i').exec(t);
  if (range) {
    const [, h1, m1, s1, h2, m2, s2] = range;
    const anchored = withSuffix(s1) || withSuffix(s2) || m1 || m2 || /\b(?:from|at|between)\s*$/i.test(t.slice(0, range.index));
    if (anchored) {
      // an end without am/pm borrows the start's, except "12" after an "am" start, which is noon
      const inherit = (sfx, h) => (withSuffix(sfx) && Number(h) !== 12 ? sfx : '');
      const start = toClock(h1, m1, s1 || (Number(h1) <= Number(h2) ? inherit(s2, h1) : ''), t);
      const end = toClock(h2, m2, s2 || (Number(h2) > Number(h1) ? inherit(s1, h2) : ''), t);
      if (start && end) return start < end ? [start, end] : [toClock(h1, m1, s1, t) || start, end];   // "10 to 12 pm" is a morning
    }
  }
  const single = new RegExp(`\\b${TIME}`, 'gi');
  let m;
  while ((m = single.exec(t))) {
    if (!withSuffix(m[3]) && !m[2] && !/\b(?:from|at)\s*$/i.test(t.slice(0, m.index))) continue;
    const clock = toClock(m[1], m[2], m[3], t);
    if (clock) return [clock];
  }
  return [];
}
function findWeeks(text) {
  const m = /\b(\d{1,2}|[a-z]+|[஀-௿]+|[ऀ-ॿ]+)\s*(weeks?|வாரம்|வாரங்கள்|வாரங்களுக்கு|हफ़्ते|हफ्ते|हफ़्तों|हफ्तों|सप्ताह)\b/i.exec(text);
  if (!m) return 0;
  const n = /^\d+$/.test(m[1]) ? Number(m[1]) : NUMBER_WORDS[m[1].toLowerCase()] || 0;
  return n >= 1 && n <= 52 ? n : 0;
}
function findGroupSize(text) {
  const m = /\b(\d{1,3})\s*(students?|children|kids|people|elders|women|men|boys|girls|மாணவர்கள்|குழந்தைகள்|பேர்|बच्चे|छात्र|लोग)\b/i.exec(text);
  return m ? Number(m[1]) : 0;
}
function findInterests(text) {
  return Object.entries(INTERESTS).filter(([, re]) => re.test(text)).map(([k]) => k).slice(0, 3);
}
// "at the government school in Kanchipuram", "in Guduvanchery" → the place phrase
function findPlace(text) {
  const m = /\b(?:at|in)\s+(the\s+)?([A-Z][\w'.-]*(?:\s+(?:of|in|at|the|[A-Z][\w'.-]*)){0,6})/.exec(text);
  return m ? m[2].replace(/[,.]+$/, '').trim() : '';
}

// Spoken edits: "change Wednesday to Thursday", "not Wednesday, Thursday", "make it 4 weeks", "place is X".
function applyEdit(draft, text) {
  const days = findDays(text);
  const edit = /\b(change|make it|not|instead|correct|rather|மாற்று|இல்லை|बदल|नहीं)\b/i.test(text);
  if (days.length >= 2 && edit) { draft.rhythm.day = days[days.length - 1]; return 'day'; }
  if (days.length === 1 && edit && draft.rhythm.day) { draft.rhythm.day = days[0]; return 'day'; }
  const weeks = findWeeks(text);
  if (weeks && edit) { draft.weeks = weeks; return 'weeks'; }
  const times = findTimes(text);
  if (times.length && edit) { draft.rhythm.start = times[0]; if (times[1]) draft.rhythm.end = times[1]; return 'start'; }
  const place = /\b(?:place|location|venue)\s+(?:is|should be|to)\s+(.+)$/i.exec(text);
  if (place) { draft.place = place[1].replace(/[.]+$/, '').trim(); return 'place'; }
  return null;
}

// Read one coordinator turn into the draft. `asked` is the field the app asked for just before it, if any.
function absorb(draft, text, asked) {
  const clean = ruleRewrite(text) || text;            // never carry a name, money or a word we avoid into the card
  if (asked === 'related') return;                     // handled by the caller (yes / no)
  if (applyEdit(draft, clean)) return;

  const days = findDays(clean);
  const times = findTimes(clean);
  const weeks = findWeeks(clean);
  const size = findGroupSize(clean);
  const place = findPlace(clean);
  const interests = findInterests(clean);

  if (asked === 'want' || !asked) {
    // a free sentence may carry all three: what is wanted, how to serve well, what a volunteer will learn
    for (const sentence of clean.split(/(?<=[.!?।])\s+/).map(x => x.trim()).filter(Boolean)) {
      if (!draft.youWillLearn && /\b(will|would|can|could)\s+learn\b|\blearn(s|ing)?\b.*\b(volunteer|you)\b|கற்றுக்கொள்|सीख/i.test(sentence)) draft.youWillLearn = sentence;
      else if (!draft.serveUsWell && (/\b(volunteers?|whoever comes|the person who comes|you)\b.*\b(should|must|can|could|need to|please|let)\b|\bplease\s+(be|come|bring|let|speak|arrive|sit)\b|serve (us|them|the group) well/i.test(sentence))) draft.serveUsWell = sentence;
      else draft.want = draft.want ? `${draft.want} ${sentence}` : sentence;
    }
  } else if (asked === 'serveUsWell') draft.serveUsWell = clean;
  else if (asked === 'youWillLearn') draft.youWillLearn = clean;
  else if (asked === 'place') draft.place = place || clean.replace(/[.]+$/, '');
  else if (asked && !days.length && !times.length && !weeks && asked !== 'day' && asked !== 'start' && asked !== 'weeks') draft[asked] = clean;

  if (days.length && !draft.rhythm.day) draft.rhythm.day = days[0];
  if (times.length && !draft.rhythm.start) { draft.rhythm.start = times[0]; if (times[1]) draft.rhythm.end = times[1]; }
  else if (times.length > 1 && !draft.rhythm.end) draft.rhythm.end = times[1];
  if (weeks && !draft.weeks) draft.weeks = weeks;
  if (size && !draft.groupSize) draft.groupSize = size;
  if (place && !draft.place && asked !== 'place') draft.place = place;
  for (const i of interests) if (!draft.interestTags.includes(i) && draft.interestTags.length < 3) draft.interestTags.push(i);
  if (!draft.title && draft.want) draft.title = titleFrom(draft.want, draft.interestTags);
}

const GROUP_NOUN = /\b(students|children|elders|women|girls|boys|families|kids)\b/i;
function titleFrom(want, tags) {
  const cap = w => w[0].toUpperCase() + w.slice(1);
  const group = GROUP_NOUN.exec(want)?.[1].toLowerCase();
  if (tags.length) return `${cap(tags.slice(0, 2).join(' and '))} with ${group || 'the group'}`;
  const words = want.replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  const short = words.slice(0, 6).join(' ');
  const t = short.length > 50 ? `${short.slice(0, 50).replace(/\s+\S*$/, '')}` : short;
  return t ? cap(t) : '';
}

function blank() {
  return { title: '', want: '', serveUsWell: '', youWillLearn: '', groupSize: 0, interestTags: [], rhythm: { day: '', start: '', end: '' }, weeks: 0, place: '' };
}
function normalize(raw) {
  const weeks = Number.isInteger(raw?.weeks) && raw.weeks > 0 ? raw.weeks : 0;   // 0 = not said yet (never a silent default)
  return { ...normalizeDraft(raw), weeks };
}

function missingOf(d) {
  const has = { want: d.want, place: d.place, day: d.rhythm.day, start: d.rhythm.start, weeks: d.weeks > 0, serveUsWell: d.serveUsWell, youWillLearn: d.youWillLearn };
  return [...REQUIRED, ...OPTIONAL].filter(k => !has[k]);
}

// A recent card whose place or title the words point to, if any
function relatedCard(draft, text, cards) {
  const hay = `${text} ${draft.place}`.toLowerCase();
  for (const c of cards || []) {
    const place = str(c.place).toLowerCase();
    const title = str(c.title).toLowerCase();
    const placeWords = place.split(/[\s,]+/).filter(w => w.length > 3);
    if (placeWords.length && placeWords.every(w => hay.includes(w))) return c;
    if (title && hay.includes(title)) return c;
  }
  return null;
}

function readBack(language, d) {
  const lines = (READ_BACK[language] || READ_BACK.en)(d).filter(Boolean);
  return lines.join(' ').replace(/\s+/g, ' ').trim();
}

// Read the latest coordinator turn into the draft (the earlier turns were read on earlier calls: the browser
// sends the draft back each time). turns: [{ role: 'coordinator' | 'app', text, field?, relatedCardId? }].
function absorbTurns({ turns = [], draft: given, context = {} }) {
  const cards = Array.isArray(context.recentCards) ? context.recentCards : [];
  const draft = normalize(given || blank());
  const last = turns[turns.length - 1];
  const prev = turns[turns.length - 2];
  const lastAsked = last?.role === 'coordinator' && prev?.role === 'app' ? prev.field : null;

  if (last?.role === 'coordinator' && lastAsked === 'related') {
    const card = cards.find(c => String(c._id) === String(prev.relatedCardId));
    if (card && YES.test(last.text)) {
      draft.place = draft.place || str(card.place);
      if (!draft.rhythm.day && card.rhythm) { draft.rhythm.day = str(card.rhythm.day); draft.rhythm.start = draft.rhythm.start || str(card.rhythm.start); draft.rhythm.end = draft.rhythm.end || str(card.rhythm.end); }
      if (!draft.weeks && card.weeks) draft.weeks = Number(card.weeks) || 0;
    } else if (card && !NO.test(last.text)) {
      absorb(draft, last.text, null);                   // not a yes or no: just more about the need
    }
  } else if (last?.role === 'coordinator') {
    absorb(draft, last.text, lastAsked);
  }
  return draft;
}

// What is still missing, and the ONE question to ask next (or none: nothing missing, or 3 already asked).
function decide({ language = 'en', turns = [], draft, context = {} }) {
  const cards = Array.isArray(context.recentCards) ? context.recentCards : [];
  const asked = turns.filter(t => t.role === 'app' && t.field);
  const last = turns[turns.length - 1];
  const prev = turns[turns.length - 2];
  const lastAsked = last?.role === 'coordinator' && prev?.role === 'app' ? prev.field : null;
  const q = QUESTIONS[language] || QUESTIONS.en;

  const missing = missingOf(draft);
  let question = null;
  let relatedCardId = null;

  // once, the related-card question, when the words point to one of the coordinator's own recent cards
  const askedRelated = asked.some(t => t.field === 'related');
  const related = !askedRelated && last?.role === 'coordinator' && lastAsked !== 'related' && relatedCard(draft, last.text, cards);
  if (related && !draft.place && asked.length < MAX_QUESTIONS) {
    relatedCardId = String(related._id);
    question = { field: 'related', text: q.related.replace('{title}', str(related.title)), relatedCardId };
  } else if (asked.length < MAX_QUESTIONS) {
    const field = missing.find(k => REQUIRED.includes(k)) || missing.find(k => OPTIONAL.includes(k)) || null;
    if (field) question = { field, text: q[field] };
  }

  const spoken = turns.filter(t => t.role === 'coordinator').map(t => str(t.text)).join(' ');
  const privacyFlags = findFlags(`${spoken}
${JSON.stringify(draft)}`).map(publicFlag);
  return { draft, missing, question, readBack: readBack(language, draft), relatedCardId, privacyFlags };
}

// The whole rule-based turn, with no model at all.
function converse(input) {
  return decide({ ...input, draft: absorbTurns(input) });
}

// Every string on a card goes through the dignity rules: a model's draft never carries a name, money or a
// word we avoid, whatever it was told.
function cleanDraft(d) {
  const out = normalize(d);
  for (const k of ['title', 'want', 'serveUsWell', 'youWillLearn', 'place']) out[k] = (out[k] && ruleRewrite(out[k])) || out[k];
  return out;
}

module.exports = { converse, absorbTurns, decide, cleanDraft, blank, normalize, missingOf, readBack, findDays, findTimes, findWeeks, applyEdit, absorb, LANGUAGES, MAX_QUESTIONS, QUESTIONS, REQUIRED, OPTIONAL };
