// Rekenlogica: geschatte kilometerstand vandaag en onderhoudsstatus per onderdeel.
const DAY = 24 * 60 * 60 * 1000;
const DEFAULT_KM_PER_DAY = 40; // ~14.600 km per jaar, gemiddelde NL-rijder

export const toDate = (iso) => new Date(`${iso}T12:00:00`);
export const todayIso = () => new Date().toISOString().slice(0, 10);
export const daysBetween = (a, b) => Math.round((b - a) / DAY);

export function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

// Combineer handmatige kilometerstanden en de kilometers uit het onderhoudslog.
export function allReadings(state) {
  const fromServices = state.services.filter((s) => s.km).map((s) => ({ date: s.date, km: +s.km }));
  const merged = [...state.odometer, ...fromServices]
    .filter((r) => r.date && Number.isFinite(+r.km))
    .map((r) => ({ date: r.date, km: +r.km }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.km - b.km);
  // Ontdubbel per dag (hoogste stand wint)
  const byDay = new Map();
  for (const r of merged) byDay.set(r.date, Math.max(r.km, byDay.get(r.date) ?? 0));
  return [...byDay].map(([date, km]) => ({ date, km }));
}

// Gemiddeld aantal km per dag, op basis van het laatste jaar aan metingen.
export function kmPerDay(readings) {
  if (readings.length < 2) return { rate: DEFAULT_KM_PER_DAY, estimated: true };
  const last = readings[readings.length - 1];
  const yearAgo = addMonths(toDate(last.date), -12);
  const first = readings.find((r) => toDate(r.date) >= yearAgo) ?? readings[0];
  const start = first === last ? readings[readings.length - 2] : first;
  const days = daysBetween(toDate(start.date), toDate(last.date));
  if (days < 14 || last.km <= start.km) return { rate: DEFAULT_KM_PER_DAY, estimated: true };
  return { rate: (last.km - start.km) / days, estimated: false };
}

export function estimateToday(state) {
  const readings = allReadings(state);
  const { rate, estimated } = kmPerDay(readings);
  if (!readings.length) return { km: null, rate, rateEstimated: estimated, readings, lastReading: null };
  const last = readings[readings.length - 1];
  const daysSince = Math.max(0, daysBetween(toDate(last.date), new Date()));
  return {
    km: Math.round(last.km + rate * daysSince),
    rate,
    rateEstimated: estimated,
    readings,
    lastReading: last,
    daysSince,
  };
}

// Status van één onderhoudsonderdeel.
export function itemStatus(item, state, est) {
  const interval = { km: item.km, months: item.months, ...(state.intervalOverrides[item.id] || {}) };
  const done = state.services
    .filter((s) => s.items.includes(item.id))
    .sort((a, b) => b.date.localeCompare(a.date) || (b.km || 0) - (a.km || 0))[0];

  if (!done) return { item, interval, done: null, state: "unknown" };

  const now = new Date();
  const doneDate = toDate(done.date);
  let kmLeft = null, kmPct = 0, kmDueDate = null;
  if (interval.km && done.km && est.km != null) {
    const used = est.km - done.km;
    kmLeft = interval.km - used;
    kmPct = used / interval.km;
    kmDueDate = new Date(now.getTime() + (kmLeft / est.rate) * DAY);
  }
  let daysLeft = null, timePct = 0, timeDueDate = null;
  if (interval.months) {
    timeDueDate = addMonths(doneDate, interval.months);
    daysLeft = daysBetween(now, timeDueDate);
    timePct = daysBetween(doneDate, now) / daysBetween(doneDate, timeDueDate);
  }

  const pct = Math.max(kmPct, timePct, 0);
  const dueDate = [kmDueDate, timeDueDate].filter(Boolean).sort((a, b) => a - b)[0] || null;
  const reason = kmPct >= timePct ? "km" : "tijd";
  const status = pct >= 1 ? "overdue" : pct >= 0.85 ? "soon" : "ok";

  return { item, interval, done, pct, kmLeft, daysLeft, dueDate, reason, state: status };
}
