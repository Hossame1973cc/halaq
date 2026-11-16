// Date/time helpers that always work in the SHOP's timezone (default Africa/Cairo),
// no matter where the visitor's device is.

function partsIn(date, tz) {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date);
  const m = {};
  p.forEach((x) => { m[x.type] = x.value; });
  return m;
}

function tzOffsetMs(date, tz) {
  const m = partsIn(date, tz);
  const asUTC = Date.UTC(+m.year, +m.month - 1, +m.day, +m.hour % 24, +m.minute, +m.second);
  return asUTC - Math.floor(date.getTime() / 1000) * 1000;
}

/** "2026-11-12" + "14:30" in tz  →  Date (UTC instant) */
export function zonedToUtc(dateStr, timeStr, tz) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = timeStr.split(':').map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const off = tzOffsetMs(new Date(guess), tz);
  let t = guess - off;
  const off2 = tzOffsetMs(new Date(t), tz);
  if (off2 !== off) t = guess - off2;
  return new Date(t);
}

/** Today's date (YYYY-MM-DD) in tz */
export function todayIn(tz) {
  const m = partsIn(new Date(), tz);
  return `${m.year}-${m.month}-${m.day}`;
}

/** Local date (YYYY-MM-DD) and time (HH:mm) of an instant in tz */
export function localParts(iso, tz) {
  const m = partsIn(new Date(iso), tz);
  return { date: `${m.year}-${m.month}-${m.day}`, time: `${m.hour}:${m.minute}` };
}

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** [start, end) of a calendar day in tz, as Date objects */
export function dayRange(dateStr, tz) {
  return [zonedToUtc(dateStr, '00:00', tz), zonedToUtc(addDays(dateStr, 1), '00:00', tz)];
}

export function weekdayOf(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
}

const loc = (lang) => (lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB');

export function fmtTime(iso, tz, lang) {
  return new Intl.DateTimeFormat(loc(lang), { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(iso));
}

export function fmtDateTime(iso, tz, lang) {
  return new Intl.DateTimeFormat(loc(lang), {
    timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(iso));
}

/** Format a plain YYYY-MM-DD date (no timezone shift) */
export function fmtDay(dateStr, lang, opts = { weekday: 'long', day: 'numeric', month: 'long' }) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Intl.DateTimeFormat(loc(lang), { timeZone: 'UTC', ...opts }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

/** "13:30:00" → "1:30 م" */
export function fmtClock(hhmm, lang) {
  const [h, m] = hhmm.split(':').map(Number);
  return new Intl.DateTimeFormat(loc(lang), { timeZone: 'UTC', hour: 'numeric', minute: '2-digit', hour12: true })
    .format(new Date(Date.UTC(2000, 0, 1, h, m)));
}
