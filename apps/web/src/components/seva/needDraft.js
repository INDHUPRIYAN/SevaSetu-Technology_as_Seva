// Pure helpers for Post a Need: draft (endpoint 28) ⇄ form fields ⇄ body of A's POST /api/needs (endpoint 6).
import { LANGUAGES } from '../../lib/languages';

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const DRAFT_LANGUAGES = LANGUAGES;

export function normalizeDay(day) {
  const value = String(day || '').trim().toLowerCase();
  if (value.length < 3) return '';
  return WEEKDAYS.find(d => d.toLowerCase().startsWith(value.slice(0, 3))) || '';
}

// "10:30", "9.30", "10:30 AM", "2 pm", "14:00" → "HH:MM" for <input type="time">, or '' if unclear
export function toTimeInput(value) {
  const m = String(value || '').trim().toLowerCase().match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?$/);
  if (!m) return '';
  let hours = Number(m[1]);
  const minutes = Number(m[2] || 0);
  const half = m[3]?.[0];
  if (half && (hours < 1 || hours > 12)) return '';
  if (half === 'p' && hours !== 12) hours += 12;
  if (half === 'a' && hours === 12) hours = 0;
  if (hours > 23 || minutes > 59) return '';
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function splitTags(text) {
  return [...new Set(String(text || '').split(/[,;\n]/).map(t => t.trim().toLowerCase()).filter(Boolean))];
}

// The read-back: the whole card as it stands, in a few spoken sentences. The card's own words stay as
// written (English, or the coordinator's), with the scaffolding in the selected language.
const READ = {
  en: { need: 'Need', place: 'Place', every: 'Every', from: 'from', to: 'to', weeks: 'for {n} weeks', serve: 'How to serve the group well', learn: 'A volunteer will learn', said: 'In the community’s words' },
  ta: { need: 'தேவை', place: 'இடம்', every: 'ஒவ்வொரு', from: 'முதல்', to: 'வரை', weeks: '{n} வாரங்களுக்கு', serve: 'குழுவிற்கு நன்றாகச் சேவை செய்வது எப்படி', learn: 'தன்னார்வலர் கற்றுக்கொள்வது', said: 'சமூகத்தின் வார்த்தைகளில்' },
  hi: { need: 'ज़रूरत', place: 'जगह', every: 'हर', from: 'से', to: 'तक', weeks: '{n} हफ़्तों के लिए', serve: 'समूह की अच्छी सेवा कैसे करें', learn: 'एक स्वयंसेवक सीखेगा', said: 'समुदाय के शब्दों में' },
};
export function readBackOf(form, original, language = 'en') {
  const r = READ[language] || READ.en;
  const f = form || {};
  const parts = [
    original?.text && `${r.said}: ${original.text}`,
    f.title && `${r.need}: ${f.title}.`,
    f.want && `${f.want}`,
    f.place && `${r.place}: ${f.place}.`,
    f.day && (language === 'ta'
      ? `${r.every} ${f.day}${f.start ? ` ${f.start} ${r.from}` : ''}${f.end ? ` ${f.end} ${r.to}` : ''}${f.weeks ? `, ${r.weeks.replace('{n}', f.weeks)}` : ''}.`
      : language === 'hi'
        ? `${r.every} ${f.day}${f.start ? ` ${f.start} ${r.from}` : ''}${f.end ? ` ${f.end} ${r.to}` : ''}${f.weeks ? `, ${r.weeks.replace('{n}', f.weeks)}` : ''}.`
        : `${r.every} ${f.day}${f.start ? ` ${r.from} ${f.start}` : ''}${f.end ? ` ${r.to} ${f.end}` : ''}${f.weeks ? `, ${r.weeks.replace('{n}', f.weeks)}` : ''}.`),
    f.serveUsWell && `${r.serve}: ${f.serveUsWell}`,
    f.youWillLearn && `${r.learn}: ${f.youWillLearn}`,
  ];
  return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

export function draftToForm(draft = {}) {
  const rhythm = draft.rhythm || {};
  return {
    title: draft.title || '',
    want: draft.want || '',
    serveUsWell: draft.serveUsWell || '',
    youWillLearn: draft.youWillLearn || '',
    groupSize: draft.groupSize ? String(draft.groupSize) : '',
    interests: Array.isArray(draft.interestTags) ? draft.interestTags.join(', ') : '',
    day: normalizeDay(rhythm.day),
    start: toTimeInput(rhythm.start),
    end: toTimeInput(rhythm.end),
    weeks: String(draft.weeks || 4),
    place: draft.place || '',
  };
}

const wholeNumber = (value, min, max) => {
  const n = Number(value);
  return String(value).trim() !== '' && Number.isInteger(n) && n >= min && n <= max;
};

// field name → message, empty when the card can be published
export function validateForm(form) {
  const errors = {};
  const required = {
    title: 'Please give the need a short title',
    want: 'Please say what the community wants',
    serveUsWell: 'Please say how a volunteer can serve them well',
    youWillLearn: 'Please say what a volunteer will learn',
    place: 'Please say where it happens',
  };
  for (const [field, message] of Object.entries(required)) if (!String(form[field] || '').trim()) errors[field] = message;
  if (String(form.title || '').trim().length > 120) errors.title = 'Please keep the title under 120 characters';
  if (!wholeNumber(form.groupSize, 1, 500)) errors.groupSize = 'Please give the group size (1 to 500)';
  if (!splitTags(form.interests).length) errors.interests = 'Please add at least one interest, such as teaching';
  if (!WEEKDAYS.includes(form.day)) errors.day = 'Please pick a day';
  if (!toTimeInput(form.start)) errors.start = 'Please give a start time';
  if (!toTimeInput(form.end)) errors.end = 'Please give an end time';
  else if (toTimeInput(form.start) && toTimeInput(form.end) <= toTimeInput(form.start)) errors.end = 'The end time must be after the start';
  if (!wholeNumber(form.weeks, 1, 52)) errors.weeks = 'Please give the number of weeks (1 to 52)';
  return errors;
}

// Local date as YYYY-MM-DD (the day the community agreed)
export function todayISO(date = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// The body of POST /api/needs: exactly the 9 draft keys, plus the consent this screen adds
// (the community confirmed the read-back, and the coordinator consents), plus the original words if given
export function formToNeed(form, agreedOn = todayISO(), original = null) {
  return {
    ...(original?.text?.trim() ? { original: { text: original.text.trim(), language: original.language } } : {}),
    title: form.title.trim(),
    want: form.want.trim(),
    serveUsWell: form.serveUsWell.trim(),
    youWillLearn: form.youWillLearn.trim(),
    groupSize: Number(form.groupSize),
    interestTags: splitTags(form.interests),
    rhythm: { day: form.day, start: toTimeInput(form.start), end: toTimeInput(form.end) },
    weeks: Number(form.weeks),
    place: form.place.trim(),
    consent: { readBack: true, coordinatorConsent: true, agreedOn },
  };
}
