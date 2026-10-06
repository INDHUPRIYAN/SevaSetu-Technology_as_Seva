// Teaching Finder, without AI: the verified wisdom items (seed/wisdom.json, verified: true only) and a
// plain word-overlap match. It only ever picks an id; the app shows the stored text and source.
const path = require('path');

const WISDOM_FILE = path.resolve(__dirname, '../../../seed/wisdom.json');

// Read fresh each time, so ticking verified: true in the file takes effect without a restart
function loadVerified(file = WISDOM_FILE) {
  delete require.cache[require.resolve(file)];
  return require(file).filter(w => w.verified === true).map(({ id, theme, text }) => ({ id, theme, text }));
}

// Everyday words that point to a theme, so "I got impatient" can find a teaching on patience
const THEME_WORDS = {
  patience: ['wait', 'waited', 'waiting', 'slow', 'impatient', 'patience', 'patient', 'frustrated', 'late', 'again', 'repeat', 'time'],
  strength: ['afraid', 'fear', 'scared', 'weak', 'tired', 'nervous', 'doubt', 'confidence', 'shy', 'strong', 'courage'],
  service: ['help', 'helping', 'serve', 'service', 'others', 'give', 'giving', 'community', 'care', 'feel', 'listen'],
  work: ['result', 'results', 'effort', 'fail', 'failed', 'work', 'praise', 'reward', 'credit', 'thanks', 'noticed', 'duty'],
};

const STOP = new Set('a an the and or but i me my we our you your he she they them it is are was were be been to of in on at for with that this what when who how did do not no so as by from had have has very just'.split(' '));

const words = text => String(text || '').toLowerCase().match(/[a-z]+/g)?.filter(w => w.length > 2 && !STOP.has(w)) || [];
const stem = w => w.replace(/(ing|ed|es|s)$/, '');

// The best verified item for a situation by shared words and theme words, or null when nothing fits
function ruleMatch(situation, items) {
  const said = words(situation);
  if (!said.length || !items.length) return null;
  const saidStems = new Set(said.map(stem));
  let best = null;
  for (const item of items) {
    const own = new Set(words(item.text).map(stem));
    let score = [...saidStems].filter(w => own.has(w)).length * 2;
    score += said.filter(w => (THEME_WORDS[item.theme] || []).includes(w)).length;
    if (score > 0 && (!best || score > best.score)) best = { id: item.id, score };
  }
  return best ? best.id : null;
}

module.exports = { loadVerified, ruleMatch, WISDOM_FILE };
