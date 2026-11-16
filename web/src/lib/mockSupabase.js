// =============================================================================
// DEMO MODE — a tiny in-browser imitation of Supabase so the app can be opened
// as a single HTML file with no server. Data is kept in this browser only.
// Used only when the app is built with VITE_DEMO=1 (npm run build:demo).
// The real logic lives in supabase/migrations/0001_schema.sql.
// =============================================================================
import { addDays, todayIn, weekdayOf, zonedToUtc, localParts } from './time';

const KEY = 'halaq.demo.db.v1';
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
const code = () => Math.random().toString(16).slice(2, 8).toUpperCase();
const nowIso = () => new Date().toISOString();
const ACTIVE = ['pending', 'confirmed', 'completed'];

// ---------------------------------------------------------------- seed data
function seed() {
  const tz = 'Africa/Cairo';
  const today = todayIn(tz);
  const ownerId = uid();
  const db = {
    users: [{ id: ownerId, email: 'demo@halaq.app', password: 'demo123', user_metadata: { full_name: 'كريم', phone: '01001234567' } }],
    profiles: [{ id: ownerId, full_name: 'كريم', phone: '01001234567' }],
    shops: [], shop_members: [], barbers: [], services: [], working_hours: [], time_off: [],
    bookings: [], booking_items: [], reviews: [], files: {},
  };
  const shopsSeed = [
    { name: 'صالون السلطان', slug: 'sultan', area: 'الزمالك - القاهرة', specialty: 'fade', description: 'متخصصين في الفيد والسكين فيد وقصات الشعر الحديثة.',
      barbers: [['طارق المنصور', 'متخصص فيد'], ['زياد المصري', 'ذقن وموس'], ['رامي', 'قص بالمقص']],
      services: [['قص شعر + غسيل', 45, 200], ['تهذيب ذقن بالموس والفوطة السخنة', 30, 120], ['باكدج كاملة (شعر + ذقن + ماسك)', 75, 350], ['تحديد سريع', 20, 80]] },
    { name: 'كوبر آند أوك', slug: 'copper-oak', area: 'مصر الجديدة - الكوربة', specialty: 'beard', description: 'حلاقة كلاسيك وفوطة سخنة في جو هادي.',
      barbers: [['يوسف نبيل', 'حلاق كلاسيك'], ['حسن فؤاد', 'حلاقة بالموس']],
      services: [['قص كلاسيك بالمقص', 45, 180], ['حلاقة ذقن بالبخار', 35, 140], ['ماسك فحم + تهذيب', 50, 250]] },
    { name: 'مونو ستوديو', slug: 'mono-studio', area: 'العبور - أفينيو مول', specialty: 'vip', description: 'تجربة عناية VIP وقصات عصرية.',
      barbers: [['آدم شريف', 'المدير الفني'], ['مروان سامي', 'تكستشر وفيد']],
      services: [['كروب + تيبر فيد', 40, 170], ['تحديد ذقن + زيت أرجان', 25, 100], ['جلسة VIP كاملة', 60, 300]] },
  ];
  const names = ['عمر حسن', 'خالد منصور', 'مصطفى عادل', 'أحمد سمير', 'محمود علي', 'يوسف طارق', 'كريم وائل', 'سيف أشرف'];
  shopsSeed.forEach((s, si) => {
    const shopId = uid();
    db.shops.push({ id: shopId, slug: s.slug, name: s.name, area: s.area, address: null, phone: '01001234567', whatsapp: '01001234567',
      specialty: s.specialty, description: s.description, cover_url: null, map_url: null, timezone: tz,
      slot_step_min: 15, min_notice_min: 30, max_days_ahead: 21, cancel_cutoff_min: 60, auto_confirm: true, is_active: true,
      plan: si === 0 ? 'pro' : 'trial', trial_ends_at: new Date(Date.now() + 22 * 864e5).toISOString(), created_by: ownerId, created_at: nowIso() });
    if (si === 0) db.shop_members.push({ shop_id: shopId, user_id: ownerId, role: 'owner' });
    for (let d = 0; d < 7; d += 1) db.working_hours.push({ shop_id: shopId, weekday: d, opens: '12:00:00', closes: d === 5 ? '02:00:00' : '23:00:00' });
    const bIds = s.barbers.map(([name, title], i) => { const id = uid(); db.barbers.push({ id, shop_id: shopId, name, title, is_active: true, sort_order: i, created_at: nowIso() }); return id; });
    const svcs = s.services.map(([name, dur, price], i) => { const o = { id: uid(), shop_id: shopId, name, description: null, duration_min: dur, price, is_active: true, sort_order: i, created_at: nowIso() }; db.services.push(o); return o; });

    // bookings: last 6 days (completed) + today
    let n = 0;
    for (let day = -6; day <= 1; day += 1) {
      const date = addDays(today, day);
      const times = day === 0 ? ['13:00', '14:00', '15:30', '17:00', '19:00', '20:30'] : ['13:00', '15:00', '18:00', '20:00'].slice(0, 2 + ((day + 10 + si) % 3));
      times.forEach((t, ti) => {
        const svc = svcs[(ti + day + 10) % svcs.length];
        const start = zonedToUtc(date, t, tz);
        const isPast = start.getTime() + svc.duration_min * 6e4 < Date.now();
        let status = isPast ? 'completed' : 'confirmed';
        if (day === 0 && ti === 4) status = 'pending';
        if (day === -2 && ti === 1) status = 'no_show';
        const id = uid();
        db.bookings.push({ id, code: code(), shop_id: shopId, barber_id: bIds[ti % bIds.length], customer_id: null,
          customer_name: names[(n += 1) % names.length], customer_phone: `0101555${String(1000 + n).slice(-4)}`,
          starts_at: start.toISOString(), ends_at: new Date(start.getTime() + svc.duration_min * 6e4).toISOString(),
          total_duration: svc.duration_min, total_price: svc.price, status, source: ti === 2 ? 'walk_in' : 'online',
          payment_method: 'at_shop', notes: ti === 0 ? 'فيد متوسط والشعر من فوق طويل' : null, manage_token: uid(), created_at: nowIso(), updated_at: nowIso() });
        db.booking_items.push({ id: uid(), booking_id: id, service_id: svc.id, service_name: svc.name, price: svc.price, duration_min: svc.duration_min });
        if (status === 'completed' && n % 2 === 0) {
          db.reviews.push({ id: uid(), booking_id: id, shop_id: shopId, barber_id: bIds[ti % bIds.length], customer_name: names[n % names.length].split(' ')[0],
            rating: n % 5 === 0 ? 4 : 5, comment: ['خدمة ممتازة ومواعيد مظبوطة', 'أحسن فيد عملته', 'المكان نضيف والتعامل محترم', null][n % 4], created_at: start.toISOString() });
        }
      });
    }
  });
  return db;
}

let db;
function load() {
  try { db = JSON.parse(localStorage.getItem(KEY)); } catch { db = null; }
  if (!db) { db = seed(); persist(); }
}
function persist() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* storage full or unavailable */ } }
export function resetDemo() { try { localStorage.removeItem(KEY); localStorage.removeItem('halaq.demo.session'); localStorage.removeItem('halaq.guestBookings'); } catch { /* ignore */ } window.location.reload(); }
if (import.meta.env.VITE_DEMO === '1') load();

const err = (message) => ({ data: null, error: { message } });

// ---------------------------------------------------------------- views
function directory() {
  return db.shops.filter((s) => s.is_active).map((s) => {
    const rs = db.reviews.filter((r) => r.shop_id === s.id);
    const prices = db.services.filter((v) => v.shop_id === s.id && v.is_active).map((v) => Number(v.price));
    return { id: s.id, slug: s.slug, name: s.name, area: s.area, specialty: s.specialty, description: s.description, cover_url: s.cover_url, timezone: s.timezone,
      rating: rs.length ? Math.round((rs.reduce((a, r) => a + r.rating, 0) / rs.length) * 10) / 10 : 0, reviews_count: rs.length, min_price: prices.length ? Math.min(...prices) : null };
  });
}
const tableRows = (t) => (t === 'shops_directory' ? directory() : db[t]);

// ---------------------------------------------------------------- select parser (supports alias:table(cols))
const SINGULAR = { shops: 'shop', barbers: 'barber', bookings: 'booking', services: 'service' };
function splitTop(s) {
  const out = []; let depth = 0; let cur = '';
  for (const ch of s) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
function project(row, parent, sel) {
  if (!sel || sel === '*') return { ...row };
  const out = {};
  splitTop(sel).forEach((part) => {
    const m = part.match(/^(?:(\w+):)?(\w+)\((.*)\)$/s);
    if (!m) { if (part === '*') Object.assign(out, row); else out[part] = row[part]; return; }
    const [, alias, table, inner] = m;
    const name = alias || table;
    const fk = `${SINGULAR[table]}_id`;
    if (fk in row) {
      const r = tableRows(table).find((x) => x.id === row[fk]);
      out[name] = r ? project(r, table, inner) : null;
    } else {
      const back = `${SINGULAR[parent]}_id`;
      out[name] = tableRows(table).filter((x) => x[back] === row.id).map((x) => project(x, table, inner));
    }
  });
  return out;
}

// ---------------------------------------------------------------- query builder
class Query {
  constructor(table) { this.table = table; this.filters = []; this.orders = []; this.op = 'select'; this.sel = '*'; this.n = null; this.mode = null; this.returning = false; }
  select(s = '*') { if (this.op === 'select') this.sel = s; else { this.returning = true; this.sel = s; } return this; }
  insert(v) { this.op = 'insert'; this.payload = v; return this; }
  update(v) { this.op = 'update'; this.payload = v; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(c, v) { this.filters.push((r) => r[c] === v || String(r[c]) === String(v)); return this; }
  gte(c, v) { this.filters.push((r) => r[c] >= v); return this; }
  lt(c, v) { this.filters.push((r) => r[c] < v); return this; }
  order(c, o = {}) { this.orders.push([c, o.ascending !== false]); return this; }
  limit(n) { this.n = n; return this; }
  single() { this.mode = 'single'; return this; }
  maybeSingle() { this.mode = 'maybe'; return this; }
  then(res, rej) { return Promise.resolve().then(() => this.run()).then(res, rej); }

  match(r) { return this.filters.every((f) => f(r)); }
  out(rows) {
    if (this.mode === 'single') return rows.length ? { data: rows[0], error: null } : err('No rows');
    if (this.mode === 'maybe') return { data: rows[0] || null, error: null };
    return { data: rows, error: null };
  }
  run() {
    const t = this.table;
    if (this.op === 'select') {
      let rows = tableRows(t).filter((r) => this.match(r));
      if (this.orders.length) {
        rows = [...rows].sort((a, b) => {
          for (const [c, asc] of this.orders) {
            if (a[c] === b[c]) continue;
            return (a[c] > b[c] ? 1 : -1) * (asc ? 1 : -1);
          }
          return 0;
        });
      }
      if (this.n != null) rows = rows.slice(0, this.n);
      return this.out(rows.map((r) => project(r, t, this.sel)));
    }
    if (this.op === 'insert') {
      const list = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((v) => ({
        id: uid(), created_at: nowIso(), is_active: true, sort_order: 0, description: null, title: null, ...v }));
      if (t === 'working_hours') list.forEach((r) => { delete r.id; r.opens = `${r.opens}`.slice(0, 5) + ':00'; r.closes = `${r.closes}`.slice(0, 5) + ':00'; });
      db[t].push(...list);
      persist();
      return this.out(this.returning ? list.map((r) => project(r, t, this.sel)) : []);
    }
    if (this.op === 'update') {
      const rows = db[t].filter((r) => this.match(r));
      if (t === 'bookings' && this.payload.status && ACTIVE.includes(this.payload.status)) {
        for (const r of rows) if (overlaps(r.barber_id, r.starts_at, r.ends_at, r.id)) return err('SLOT_TAKEN');
      }
      rows.forEach((r) => Object.assign(r, this.payload, t === 'bookings' ? { updated_at: nowIso() } : {}));
      persist();
      return this.out(this.returning ? rows.map((r) => project(r, t, this.sel)) : []);
    }
    if (this.op === 'delete') {
      if (t === 'barbers' && db.bookings.some((b) => db.barbers.some((x) => this.match(x) && x.id === b.barber_id))) return err('violates foreign key');
      db[t] = db[t].filter((r) => !this.match(r));
      persist();
      return this.out([]);
    }
    return err('unsupported');
  }
}

// ---------------------------------------------------------------- business logic (mirrors the SQL functions)
function overlaps(barberId, s, e, ignoreId) {
  return db.bookings.some((b) => b.id !== ignoreId && b.barber_id === barberId && ACTIVE.includes(b.status) && b.starts_at < e && b.ends_at > s);
}
function blocked(shopId, barberId, s, e) {
  return db.time_off.some((o) => o.shop_id === shopId && (!o.barber_id || o.barber_id === barberId) && o.starts_at < e && o.ends_at > s);
}
function slots({ p_shop, p_date, p_duration, p_barber }) {
  const shop = db.shops.find((s) => s.id === p_shop && s.is_active);
  if (!shop) return [];
  const wh = db.working_hours.find((w) => w.shop_id === p_shop && w.weekday === weekdayOf(p_date));
  if (!wh) return [];
  const tz = shop.timezone;
  if (p_date > addDays(todayIn(tz), shop.max_days_ahead)) return [];
  const open = zonedToUtc(p_date, wh.opens.slice(0, 5), tz).getTime();
  const close = (wh.closes <= wh.opens ? zonedToUtc(addDays(p_date, 1), wh.closes.slice(0, 5), tz) : zonedToUtc(p_date, wh.closes.slice(0, 5), tz)).getTime();
  const barbers = db.barbers.filter((b) => b.shop_id === p_shop && b.is_active && (!p_barber || b.id === p_barber));
  const out = [];
  for (let t = open; t + p_duration * 6e4 <= close; t += shop.slot_step_min * 6e4) {
    if (t < Date.now() + shop.min_notice_min * 6e4) continue;
    const s = new Date(t).toISOString();
    const e = new Date(t + p_duration * 6e4).toISOString();
    const free = barbers.filter((b) => !overlaps(b.id, s, e) && !blocked(p_shop, b.id, s, e)).map((b) => b.id);
    if (free.length) out.push({ slot_start: s, barber_ids: free });
  }
  return out;
}
function bookingView(b) {
  const s = db.shops.find((x) => x.id === b.shop_id);
  const br = db.barbers.find((x) => x.id === b.barber_id);
  return {
    ...b,
    can_cancel: ['pending', 'confirmed'].includes(b.status) && new Date(b.starts_at).getTime() - s.cancel_cutoff_min * 6e4 > Date.now(),
    can_review: b.status === 'completed' && !db.reviews.some((r) => r.booking_id === b.id),
    shop: { id: s.id, name: s.name, slug: s.slug, area: s.area, address: s.address, phone: s.phone, whatsapp: s.whatsapp, timezone: s.timezone, map_url: s.map_url, cancel_cutoff_min: s.cancel_cutoff_min },
    barber: { id: br?.id, name: br?.name || '—' },
    items: db.booking_items.filter((i) => i.booking_id === b.id).map((i) => ({ name: i.service_name, price: i.price, duration_min: i.duration_min })),
  };
}

const RPC = {
  is_slug_available: ({ p_slug }) => /^[a-z0-9][a-z0-9-]{2,39}$/.test(p_slug) && !db.shops.some((s) => s.slug === p_slug),
  get_available_slots: slots,
  create_shop({ p_name, p_slug, p_area, p_phone }) {
    if (!session) throw new Error('AUTH_REQUIRED');
    if (db.shops.some((s) => s.slug === p_slug)) throw new Error('SLUG_TAKEN');
    const shop = { id: uid(), slug: p_slug, name: p_name, area: p_area, address: null, phone: p_phone, whatsapp: p_phone, specialty: null, description: null, cover_url: null, map_url: null,
      timezone: 'Africa/Cairo', slot_step_min: 15, min_notice_min: 30, max_days_ahead: 21, cancel_cutoff_min: 60, auto_confirm: true, is_active: true, plan: 'trial',
      trial_ends_at: new Date(Date.now() + 30 * 864e5).toISOString(), created_by: session.user.id, created_at: nowIso() };
    db.shops.push(shop);
    db.shop_members.push({ shop_id: shop.id, user_id: session.user.id, role: 'owner' });
    for (let d = 0; d < 7; d += 1) db.working_hours.push({ shop_id: shop.id, weekday: d, opens: '12:00:00', closes: '23:00:00' });
    persist();
    return shop;
  },
  create_booking({ p_shop, p_service_ids, p_starts_at, p_name, p_phone, p_barber, p_notes, p_payment, p_source }) {
    const shop = db.shops.find((s) => s.id === p_shop);
    if (!shop) throw new Error('SHOP_NOT_FOUND');
    if ((p_name || '').trim().length < 2) throw new Error('NAME_REQUIRED');
    const phone = String(p_phone || '').replace(/[^0-9+]/g, '');
    if (phone.length < 7) throw new Error('PHONE_REQUIRED');
    const svcs = db.services.filter((s) => s.shop_id === p_shop && s.is_active && p_service_ids.includes(s.id));
    if (!svcs.length || svcs.length !== new Set(p_service_ids).size) throw new Error('INVALID_SERVICES');
    const dur = svcs.reduce((a, s) => a + s.duration_min, 0);
    const price = svcs.reduce((a, s) => a + Number(s.price), 0);
    const startIso = new Date(p_starts_at).toISOString();
    let barber = p_barber;
    let status = 'confirmed';
    if (p_source === 'online') {
      if (db.bookings.filter((b) => b.shop_id === p_shop && b.customer_phone === phone && ['pending', 'confirmed'].includes(b.status) && new Date(b.starts_at) > Date.now()).length >= 3) throw new Error('TOO_MANY_BOOKINGS');
      const slot = slots({ p_shop, p_date: localParts(startIso, shop.timezone).date, p_duration: dur, p_barber }).find((s) => s.slot_start === startIso);
      if (!slot) throw new Error('SLOT_TAKEN');
      if (!barber) {
        const day = localParts(startIso, shop.timezone).date;
        barber = [...slot.barber_ids].sort((a, b) => db.bookings.filter((k) => k.barber_id === a && localParts(k.starts_at, shop.timezone).date === day).length
          - db.bookings.filter((k) => k.barber_id === b && localParts(k.starts_at, shop.timezone).date === day).length)[0];
      }
      status = shop.auto_confirm ? 'confirmed' : 'pending';
    } else if (!barber) throw new Error('BARBER_REQUIRED');
    const endIso = new Date(new Date(startIso).getTime() + dur * 6e4).toISOString();
    if (overlaps(barber, startIso, endIso)) throw new Error('SLOT_TAKEN');
    const b = { id: uid(), code: code(), shop_id: p_shop, barber_id: barber, customer_id: p_source === 'online' ? session?.user.id || null : null,
      customer_name: p_name.trim(), customer_phone: phone, starts_at: startIso, ends_at: endIso, total_duration: dur, total_price: price, status,
      source: p_source || 'online', payment_method: p_payment || 'at_shop', notes: (p_notes || '').trim() || null, manage_token: uid(), created_at: nowIso(), updated_at: nowIso() };
    db.bookings.push(b);
    svcs.forEach((s) => db.booking_items.push({ id: uid(), booking_id: b.id, service_id: s.id, service_name: s.name, price: s.price, duration_min: s.duration_min }));
    persist();
    return { id: b.id, code: b.code, manage_token: b.manage_token, status: b.status, starts_at: b.starts_at, ends_at: b.ends_at, total_price: b.total_price, barber_id: b.barber_id };
  },
  get_booking_by_token({ p_token }) { const b = db.bookings.find((x) => x.manage_token === p_token); return b ? bookingView(b) : null; },
  cancel_booking_by_token({ p_token }) {
    const b = db.bookings.find((x) => x.manage_token === p_token);
    if (!b) throw new Error('NOT_FOUND');
    const v = bookingView(b);
    if (!['pending', 'confirmed'].includes(b.status)) throw new Error('NOT_CANCELLABLE');
    if (!v.can_cancel) throw new Error('TOO_LATE');
    b.status = 'cancelled';
    persist();
    return bookingView(b);
  },
  submit_review({ p_token, p_rating, p_comment }) {
    const b = db.bookings.find((x) => x.manage_token === p_token);
    if (!b) throw new Error('NOT_FOUND');
    if (b.status !== 'completed') throw new Error('NOT_COMPLETED');
    if (!db.reviews.some((r) => r.booking_id === b.id)) {
      db.reviews.push({ id: uid(), booking_id: b.id, shop_id: b.shop_id, barber_id: b.barber_id, customer_name: b.customer_name.split(' ')[0], rating: p_rating, comment: (p_comment || '').trim() || null, created_at: nowIso() });
      persist();
    }
    return null;
  },
};

// ---------------------------------------------------------------- auth
const SKEY = 'halaq.demo.session';
let session = null;
try { session = JSON.parse(localStorage.getItem(SKEY)); } catch { session = null; }
const listeners = new Set();
function setSession(s, event) {
  session = s;
  try { if (s) localStorage.setItem(SKEY, JSON.stringify(s)); else localStorage.removeItem(SKEY); } catch { /* ignore */ }
  listeners.forEach((fn) => fn(event, s));
}
const makeSession = (u) => ({ access_token: 'demo', user: { id: u.id, email: u.email, user_metadata: u.user_metadata } });

const auth = {
  getSession: async () => ({ data: { session }, error: null }),
  onAuthStateChange(fn) { listeners.add(fn); return { data: { subscription: { unsubscribe: () => listeners.delete(fn) } } }; },
  async signInWithPassword({ email, password }) {
    const u = db.users.find((x) => x.email.toLowerCase() === email.toLowerCase() && x.password === password);
    if (!u) return err('Invalid login credentials');
    const s = makeSession(u); setSession(s, 'SIGNED_IN'); return { data: { session: s, user: s.user }, error: null };
  },
  async signUp({ email, password, options }) {
    if (db.users.some((x) => x.email.toLowerCase() === email.toLowerCase())) return err('User already registered');
    if ((password || '').length < 6) return err('Password should be at least 6 characters');
    const u = { id: uid(), email, password, user_metadata: options?.data || {} };
    db.users.push(u);
    db.profiles.push({ id: u.id, full_name: u.user_metadata.full_name || '', phone: u.user_metadata.phone || '' });
    persist();
    const s = makeSession(u); setSession(s, 'SIGNED_IN'); return { data: { session: s, user: s.user }, error: null };
  },
  async signOut() { setSession(null, 'SIGNED_OUT'); return { error: null }; },
  async resetPasswordForEmail() { return { data: {}, error: null }; },
  async updateUser({ password }) { const u = db.users.find((x) => x.id === session?.user.id); if (u && password) { u.password = password; persist(); } return { data: {}, error: null }; },
};

// ---------------------------------------------------------------- storage (images saved as data URLs)
const storage = {
  from: () => ({
    upload: (path, file) => new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => { db.files[path] = r.result; persist(); resolve({ data: { path }, error: null }); };
      r.onerror = () => resolve(err('upload failed'));
      r.readAsDataURL(file);
    }),
    getPublicUrl: (path) => ({ data: { publicUrl: db.files[path] || '' } }),
  }),
};

export const mockSupabase = {
  from: (t) => new Query(t),
  async rpc(name, args) {
    try { return { data: RPC[name](args || {}), error: null }; } catch (e) { return err(e.message); }
  },
  auth,
  storage,
  channel: () => { const ch = { on: () => ch, subscribe: () => ch }; return ch; },
  removeChannel: () => {},
};
