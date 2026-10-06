// One block per week: served / covered / cannot come / upcoming. Never hours.
const tone = {
  served: 'bg-served text-white',
  covered: 'bg-covered text-white',
  gap: 'bg-cream-50 text-ink-500 ring-2 ring-inset ring-gap [background-image:repeating-linear-gradient(135deg,transparent_0_5px,rgb(201_180_164/0.35)_5px_7px)]',
  upcoming: 'bg-cream-200 text-ink-500',
};

export const LEGEND = [
  ['served', 'Served'],
  ['covered', 'Covered'],
  ['gap', 'Cannot come'],
  ['upcoming', 'Upcoming'],
];

export default function WeekStrip({ sessions, currentWeek, legend = true, className = '' }) {
  return (
    <div className={className}>
      <ol className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(sessions.length, 8)}, minmax(0, 1fr))` }}>
        {sessions.map(s => (
          <li
            key={s.week}
            title={`Week ${s.week}: ${s.status}${s.coveredByName ? ` by ${s.coveredByName}` : ''}`}
            className={`flex h-9 items-center justify-center rounded-xl text-xs font-semibold ${tone[s.status]} ${s.week === currentWeek ? 'outline-2 outline-offset-2 outline-ink-800' : ''}`}
          >
            {s.week}
          </li>
        ))}
      </ol>
      {legend && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
          {LEGEND.map(([k, label]) => (
            <li key={k} className="flex items-center gap-1.5">
              <span className={`h-3 w-3 rounded ${tone[k]}`} /> {label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
