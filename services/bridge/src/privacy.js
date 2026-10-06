// Simple word checks that run even when the AI is off. They warn the coordinator; they never block.
// The coordinator's own read-back is the final check.
const CHECKS = [
  [/₹|\b(income|salary|salaries|rupees?|rs\.?|inr)\b/i, 'Mentions money or income'],
  [/\b(caste|religion|hindu|muslim|christian|sikh|jain|buddhist|dalit)\b/i, 'Mentions caste or religion'],
  [/\b(disease|illness|disabled|disability|handicapped|hiv|tb|tuberculosis|cancer)\b/i, 'Mentions a health detail'],
  [/\b(poor|needy)\b|\bbeneficiar/i, 'Uses a word we avoid about the people served'],
  [/\b\d{1,3}\s*-?\s*(years?|yrs?)\s*-?\s*old\b|\baged?\s*\d{1,3}\b/i, "Mentions a person's age"],
];

function findPrivacyFlags(text) {
  const value = String(text || '');
  return CHECKS.filter(([pattern]) => pattern.test(value)).map(([, message]) => message);
}

module.exports = { findPrivacyFlags };
