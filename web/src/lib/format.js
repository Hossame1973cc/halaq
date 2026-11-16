export function money(n, lang) {
  const v = Number(n || 0);
  return new Intl.NumberFormat(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-EG', {
    style: 'currency', currency: 'EGP', maximumFractionDigits: v % 1 ? 2 : 0,
  }).format(v);
}

/** Egyptian-friendly WhatsApp number: 010xxxxxxxx → 2010xxxxxxxx */
export function waNumber(phone) {
  let p = String(phone || '').replace(/[^\d+]/g, '');
  if (p.startsWith('+')) p = p.slice(1);
  if (p.startsWith('00')) p = p.slice(2);
  if (p.startsWith('0') && p.length === 11) p = `2${p}`;
  return p;
}

export function waLink(phone, text) {
  const n = waNumber(phone);
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/** Map database error codes (raised in SQL) to i18n keys */
export function errorKey(err) {
  const msg = String(err?.message || err || '');
  const codes = ['SLOT_TAKEN', 'TOO_MANY_BOOKINGS', 'INVALID_SERVICES', 'NAME_REQUIRED', 'PHONE_REQUIRED',
    'SLUG_TAKEN', 'SHOP_LIMIT', 'TOO_LATE', 'NOT_CANCELLABLE', 'NOT_FOUND', 'BARBER_REQUIRED', 'FORBIDDEN',
    'AUTH_REQUIRED', 'SHOP_NOT_FOUND'];
  const hit = codes.find((c) => msg.includes(c));
  if (hit) return `err.${hit}`;
  if (/Invalid login credentials/i.test(msg)) return 'err.LOGIN';
  if (/already registered/i.test(msg)) return 'err.EXISTS';
  if (/Password should be/i.test(msg)) return 'err.PASSWORD';
  if (/violates foreign key/i.test(msg)) return 'err.IN_USE';
  if (/Failed to fetch|NetworkError/i.test(msg)) return 'err.NETWORK';
  return 'err.GENERIC';
}

// Bookings made on this device without an account (so "My bookings" works for guests)
const KEY = 'halaq.guestBookings';
export function rememberBooking(token) {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]').filter((x) => x !== token);
    list.unshift(token);
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 30)));
  } catch { /* storage unavailable */ }
}
export function guestBookings() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

const CKEY = 'halaq.customer';
export function savedCustomer() {
  try { return JSON.parse(localStorage.getItem(CKEY) || '{}'); } catch { return {}; }
}
export function saveCustomer(c) {
  try { localStorage.setItem(CKEY, JSON.stringify(c)); } catch { /* ignore */ }
}

export function downloadIcs({ title, start, end, location, description }) {
  const f = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Halaq//Booking//AR', 'BEGIN:VEVENT',
    `UID:${f(start)}-${Math.random().toString(36).slice(2)}@halaq`, `DTSTAMP:${f(new Date())}`,
    `DTSTART:${f(start)}`, `DTEND:${f(end)}`, `SUMMARY:${title}`,
    location ? `LOCATION:${location}` : '', description ? `DESCRIPTION:${description}` : '',
    'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', `DESCRIPTION:${title}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  a.download = 'halaq-booking.ics';
  a.click();
}
