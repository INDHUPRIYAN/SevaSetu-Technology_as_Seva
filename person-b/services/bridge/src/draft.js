// The need card shape shared with A's POST /api/needs (endpoint 6). Exactly these 9 keys.
const FALLBACK = require('./fallbackDraft.json');

const DRAFT_KEYS = ['title', 'want', 'serveUsWell', 'youWillLearn', 'groupSize', 'interestTags', 'rhythm', 'weeks', 'place'];
const DEFAULT_WEEKS = 4;                         // every commitment starts at 4 weeks

const str = v => (typeof v === 'string' ? v.trim() : '');
const count = v => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : 0;
};

// Whatever the AI sent, return exactly the 9 keys with the right types.
function normalizeDraft(raw) {
  const d = raw && typeof raw === 'object' ? raw : {};
  const rhythm = d.rhythm && typeof d.rhythm === 'object' ? d.rhythm : {};
  return {
    title: str(d.title),
    want: str(d.want),
    serveUsWell: str(d.serveUsWell),
    youWillLearn: str(d.youWillLearn),
    groupSize: count(d.groupSize),
    interestTags: Array.isArray(d.interestTags) ? [...new Set(d.interestTags.map(str).filter(Boolean))] : [],
    rhythm: { day: str(rhythm.day), start: str(rhythm.start), end: str(rhythm.end) },
    weeks: count(d.weeks) || DEFAULT_WEEKS,
    place: str(d.place),
  };
}

const fallbackDraft = () => structuredClone(FALLBACK);

module.exports = { DRAFT_KEYS, normalizeDraft, fallbackDraft };
