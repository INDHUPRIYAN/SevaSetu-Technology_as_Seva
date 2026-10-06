// "10:30" -> "10:30 AM"
export function time(hhmm) {
  if (!hhmm) return '';
  const [h, m = '00'] = String(hhmm).split(':');
  const hour = Number(h);
  if (Number.isNaN(hour)) return hhmm;
  return `${hour % 12 || 12}:${m.padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}

// { day, start, end } -> "Every Saturday 10:30 AM – 12:00 PM"
export function rhythm(r) {
  if (!r?.day) return '';
  const hours = r.start ? ` ${time(r.start)}${r.end ? ` – ${time(r.end)}` : ''}` : '';
  return `Every ${r.day}${hours}`;
}

export const initials = name =>
  String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');

export const firstName = name => String(name || '').split(' ')[0];

export const shortDate = d =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';
