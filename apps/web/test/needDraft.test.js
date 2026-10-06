// needDraft.js — draft (endpoint 28) ⇄ form ⇄ body of A's POST /api/needs (endpoint 6).
import { describe, expect, it } from 'vitest';
import {
  draftToForm, formToNeed, normalizeDay, splitTags, todayISO, toTimeInput, validateForm,
} from '../src/components/seva/needDraft';

const FALLBACK = {
  title: 'English Reading Support', want: 'A group of 12 students would like help.', serveUsWell: 'Come on time.',
  youWillLearn: 'Patience.', groupSize: 12, interestTags: ['teaching', 'reading'],
  rhythm: { day: 'Saturday', start: '10:30', end: '12:00' }, weeks: 4, place: 'Government School, Kanchipuram',
};
const DRAFT_KEYS = ['title', 'want', 'serveUsWell', 'youWillLearn', 'groupSize', 'interestTags', 'rhythm', 'weeks', 'place'];

describe('toTimeInput', () => {
  it.each([
    ['10:30', '10:30'], ['9:05', '09:05'], ['9.30', '09:30'], ['10:30 AM', '10:30'], ['2 pm', '14:00'],
    ['12 pm', '12:00'], ['12:15 am', '00:15'], ['14:00', '14:00'], ['', ''], ['morning', ''], ['25:00', ''], ['13 pm', ''],
  ])('%s → %s', (input, out) => expect(toTimeInput(input)).toBe(out));
});

describe('normalizeDay', () => {
  it.each([['Saturday', 'Saturday'], ['sat', 'Saturday'], ['SATURDAYS', 'Saturday'], ['mon', 'Monday'], ['', ''], ['xyz', ''], ['Sa', '']])(
    '%s → %s', (input, out) => expect(normalizeDay(input)).toBe(out),
  );
});

describe('splitTags', () => {
  it('lowercases, trims, drops empties and repeats', () => {
    expect(splitTags(' Teaching, reading;; Reading ,\nart ')).toEqual(['teaching', 'reading', 'art']);
    expect(splitTags('')).toEqual([]);
  });
});

describe('draftToForm → formToNeed', () => {
  it('a full draft round-trips to exactly the 9 keys plus consent', () => {
    const body = formToNeed(draftToForm(FALLBACK), '2026-10-06');
    expect(Object.keys(body).sort()).toEqual([...DRAFT_KEYS, 'consent'].sort());
    expect(body).toEqual({ ...FALLBACK, consent: { readBack: true, coordinatorConsent: true, agreedOn: '2026-10-06' } });
  });

  it('an empty AI draft gives an empty form with 4 weeks, and is not publishable', () => {
    const form = draftToForm({ title: '', want: '', groupSize: 0, interestTags: [], rhythm: { day: '', start: '', end: '' }, weeks: 0, place: '' });
    expect(form.weeks).toBe('4');
    expect(form.groupSize).toBe('');
    expect(Object.keys(validateForm(form)).sort())
      .toEqual(['day', 'end', 'groupSize', 'interests', 'place', 'serveUsWell', 'start', 'title', 'want', 'youWillLearn']);
  });

  it('a draft with "10:30 AM" and "sat" fills the time and day inputs', () => {
    const form = draftToForm({ ...FALLBACK, rhythm: { day: 'sat', start: '10:30 AM', end: '12 pm' } });
    expect([form.day, form.start, form.end]).toEqual(['Saturday', '10:30', '12:00']);
  });
});

describe('validateForm', () => {
  const good = draftToForm(FALLBACK);
  it('a complete card has no errors', () => expect(validateForm(good)).toEqual({}));
  it('end must be after start', () => expect(validateForm({ ...good, end: '10:00' }).end).toMatch(/after/));
  it('group size and weeks must be whole numbers in range', () => {
    expect(validateForm({ ...good, groupSize: '0' }).groupSize).toBeTruthy();
    expect(validateForm({ ...good, groupSize: '2.5' }).groupSize).toBeTruthy();
    expect(validateForm({ ...good, weeks: '53' }).weeks).toBeTruthy();
  });
  it('blank text fields are errors', () => expect(validateForm({ ...good, title: '   ' }).title).toBeTruthy());
});

describe('todayISO', () => {
  it('is the local date as YYYY-MM-DD', () => expect(todayISO(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05'));
});
