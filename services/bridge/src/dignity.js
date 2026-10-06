// Dignity Check, rule-based. Works with no AI key. Finds the words a need card must not carry — a
// person's name or age, money, caste, religion, health details, and the words we avoid — explains each in
// one line, and builds a respectful rewrite. It only suggests: the coordinator accepts or rejects it.
// The rules read English (and numbers and ₹ in any language). Names in other scripts need the AI pass.

const NAME = "[A-Z][a-z]{2,}";
const PERSON_NOUN = '(?:boy|girl|child|kid|student|son|daughter|man|woman|lady|gentleman|person)';

// Each rule: kind, a one-line reason, a pattern (global), and what the matched words become in the rewrite.
const RULES = [
  {
    kind: 'name',
    why: 'Names one person. A need card describes the group, never an individual.',
    // "Ravi, a poor boy" — a name followed by who they are
    pattern: new RegExp(`\\b${NAME},\\s+(?:a|an|the)\\s+(?:\\w+\\s+)?${PERSON_NOUN}\\b`, 'g'),
    replace: 'a group of students',
  },
  {
    kind: 'name',
    why: 'Names one person. A need card describes the group, never an individual.',
    // "boy Ravi", "student named Ravi", "Mr. Kumar"
    pattern: new RegExp(`\\b(?:${PERSON_NOUN}\\s+(?:named\\s+|called\\s+)?|named\\s+|called\\s+|(?:Mr|Mrs|Ms|Shri|Smt)\\.?\\s+)${NAME}\\b`, 'gi'),
    replace: 'a group of students',
    caseSensitiveName: true,
  },
  {
    kind: 'name',
    why: 'Names one person and their family. Describe the group instead.',
    pattern: new RegExp(`\\b${NAME}'s\\s+(?:father|mother|parents|family|brother|sister)\\b`, 'g'),
    replace: '',
  },
  {
    kind: 'money',
    why: 'Mentions money or income. A need card never carries anyone’s money details.',
    pattern: /(?:\b(?:his|her|their)\s+)?(?:\b(?:father|mother|parent|family)(?:'s)?\s+)?(?:\bmonthly\s+)?\b(?:income|salary|earnings)\b(?:\s+(?:is|of|was))?(?:\s*(?:₹|rs\.?|rupees|inr))?\s*[\d,]*\d(?:\s*(?:rupees|rs))?|(?:₹|\brs\.?|\binr)\s*[\d,]*\d|\b\d[\d,]*\s*(?:rupees|rs)\b|\b(?:income|salary|salaries|earnings)\b/gi,
    replace: '',
  },
  {
    kind: 'caste or religion',
    why: 'Mentions caste or religion. The card describes what the group wants, not who they are by birth or faith.',
    pattern: /\b(?:caste|religion|hindu|muslim|christian|sikh|jain|buddhist|dalit|brahmin|sc\/st|obc)s?\b/gi,
    replace: '',
  },
  {
    kind: 'health',
    why: 'Mentions a health detail. Health stays private to the people served.',
    pattern: /\b(?:disease|illness|ill|sick|disabled|disability|handicapped|hiv|aids|tb|tuberculosis|cancer|diabetic|blind|deaf)\b/gi,
    replace: '',
  },
  {
    kind: 'age',
    why: 'Gives one person’s age. Describe the group by class or age range instead.',
    pattern: /\b\d{1,3}\s*-?\s*(?:years?|yrs?)\s*-?\s*old\b|\baged?\s*\d{1,3}\b/gi,
    replace: '',
  },
  {
    kind: 'word we avoid',
    why: '“Poor” and “needy” describe people by what they lack. Say what the group wants instead.',
    pattern: /\b(?:poor|needy|underprivileged)\b/gi,
    replace: '',
  },
  {
    kind: 'word we avoid',
    why: '“Beneficiary” makes people receivers. Say “people served” or “the community”.',
    pattern: /\b(?:(?:our|the)\s+)?beneficiar(?:y|ies)\b/gi,
    replace: m => (/^(our|the)\s/i.test(m) ? 'the people we serve' : 'people served'),
  },
  {
    kind: 'word we avoid',
    why: '“Donor” turns seva into giving things away. Say “volunteer” or “organisation”.',
    pattern: /\bdonors?\b/gi,
    replace: m => (/s$/i.test(m) ? 'volunteers' : 'volunteer'),
  },
  {
    kind: 'word we avoid',
    why: '“Case” makes a person a file. Say “need” instead.',
    pattern: /(?<!\bin\s)(?<!\bjust\sin\s)\bcases?\b/gi,
    replace: m => (/s$/i.test(m) ? 'needs' : 'need'),
  },
];

// Every flagged span, in order, without overlaps (the first rule to claim a span keeps it)
function findFlags(text) {
  const value = String(text || '');
  const flags = [];
  for (const rule of RULES) {
    for (const m of value.matchAll(rule.pattern)) {
      // a name rule only fires when the name itself is capitalised, whatever the case of the cue word
      if (rule.caseSensitiveName && !new RegExp(`${NAME}$`).test(m[0])) continue;
      const start = m.index;
      const end = start + m[0].length;
      if (flags.some(f => start < f.end && end > f.start)) continue;
      flags.push({ start, end, match: m[0], kind: rule.kind, why: rule.why, replace: rule.replace });
    }
  }
  return flags.sort((a, b) => a.start - b.start);
}

// Tidy what is left after words are taken out: spaces, doubled commas, a dangling "a", the first capital
function tidy(text) {
  return text.trim()
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([,;])(?:\s*[,;])+/g, '$1')
    .replace(/\b(a|an)\s+(a|an|the)\b/gi, '$2')
    .replace(/\b(?:who|which)\s+(?:is|are|was|were)\s*(?=[,.;!?]|$)/gi, '')
    .replace(/\b(?:with|has|have|and|or|of|is|are)\s*(?=[,.;!?]|$)/gi, '')
    .replace(/\b(a|an|the)\s*(?=[,.;!?]|$)/gi, '')
    .replace(/(a group of students),\s+(?=(?:wants|needs|would|likes|loves|is|has|asks)\b)/gi, '$1 ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/(^|[.!?]\s+)(?:[,;]\s*)?(?:and|or)\s+/gi, '$1')
    .replace(/(^|[.!?]\s+)[,;]\s*/g, '$1')
    .replace(/[,;](\s*[.!?]|\s*$)/g, '$1')
    .replace(/(^|[.!?]\s+)([a-z])/g, (_, before, c) => before + c.toUpperCase())
    .trim();
}

// The rule-based rewrite: each flagged span replaced, then tidied. Null when nothing was flagged.
function ruleRewrite(text, flags = findFlags(text)) {
  if (!flags.length) return null;
  let out = '';
  let at = 0;
  for (const f of flags) {
    out += text.slice(at, f.start) + (typeof f.replace === 'function' ? f.replace(f.match) : f.replace);
    at = f.end;
  }
  return tidy(out + text.slice(at)) || null;
}

const publicFlag = ({ start, end, match, kind, why }) => ({ start, end, match, kind, why });

module.exports = { findFlags, ruleRewrite, publicFlag, RULES };
