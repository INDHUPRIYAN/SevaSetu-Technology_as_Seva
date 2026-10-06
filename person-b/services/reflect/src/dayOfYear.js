// Day of the year (1 to 366) for a date as seen in one time zone.
// "Seva Wisdom for Today" uses India time, so the quote does not change at 5:30 in the morning.
function dayOfYear(date, timeZone) {
  const parts = {};
  const format = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric' });
  for (const p of format.formatToParts(date)) parts[p.type] = Number(p.value);
  return Math.round((Date.UTC(parts.year, parts.month - 1, parts.day) - Date.UTC(parts.year, 0, 0)) / 86400000);
}

module.exports = { dayOfYear };
