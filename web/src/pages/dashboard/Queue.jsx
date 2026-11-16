import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase, SITE_URL } from '../../lib/supabase';
import { useI18n } from '../../lib/i18n';
import { errorKey, money, waLink } from '../../lib/format';
import { addDays, dayRange, fmtDay, fmtTime, localParts, todayIn, zonedToUtc } from '../../lib/time';
import { Badge, Button, Card, Empty, Field, Input, Loading, Modal, Select, cx, useToast } from '../../components/ui';
import { STATUS_TONE } from '../ManageBooking';
import { useDash } from './DashboardLayout';

const ACTIVE = ['pending', 'confirmed', 'completed'];
const NO_PHONE = '0000000'; // placeholder for walk-ins without a number

function BarChart({ data, lang }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-2 h-44" dir="ltr">
      {data.map((d) => (
        <div key={d.key} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
          <span className="text-[10px] text-slate-400">{d.value ? money(d.value, lang) : ''}</span>
          <div className={cx('w-full rounded-t-md transition-all', d.highlight ? 'gold-gradient' : 'bg-amber-500/30')}
            style={{ height: `${Math.max(3, (d.value / max) * 100)}%` }} title={`${d.count}`} />
          <span className={cx('text-[10px]', d.highlight ? 'text-amber-400 font-bold' : 'text-slate-500')}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function Queue() {
  const { shop, barbers, services } = useDash();
  const { t, lang } = useI18n();
  const toast = useToast();
  const tz = shop.timezone;
  const [date, setDate] = useState(() => todayIn(tz));
  const [rows, setRows] = useState(null);
  const [week, setWeek] = useState([]);
  const [filter, setFilter] = useState('all');
  const [barberF, setBarberF] = useState('');
  const [q, setQ] = useState('');
  const [walkIn, setWalkIn] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const knownIds = useRef(new Set());

  const load = useCallback(async (notify = false) => {
    const [start, end] = dayRange(date, tz);
    const [wStart] = dayRange(addDays(date, -6), tz);
    const [day, wk] = await Promise.all([
      supabase.from('bookings').select('*, items:booking_items(service_name)')
        .eq('shop_id', shop.id).gte('starts_at', start.toISOString()).lt('starts_at', end.toISOString()).order('starts_at'),
      supabase.from('bookings').select('starts_at, total_price, status')
        .eq('shop_id', shop.id).gte('starts_at', wStart.toISOString()).lt('starts_at', end.toISOString()),
    ]);
    const list = day.data || [];
    if (notify && list.some((b) => !knownIds.current.has(b.id))) toast(`🔔 ${t('queue.newBooking')}`);
    knownIds.current = new Set(list.map((b) => b.id));
    setRows(list);
    setWeek(wk.data || []);
  }, [date, tz, shop.id, t, toast]);

  useEffect(() => { setRows(null); load(); }, [load]);

  // Live updates: Supabase Realtime + a light polling fallback
  useEffect(() => {
    const ch = supabase.channel(`bookings-${shop.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `shop_id=eq.${shop.id}` }, () => load(true))
      .subscribe();
    const id = setInterval(() => load(true), 60000);
    return () => { supabase.removeChannel(ch); clearInterval(id); };
  }, [shop.id, load]);

  const barberName = (id) => barbers.find((b) => b.id === id)?.name || '—';

  const shown = useMemo(() => (rows || []).filter((b) => {
    if (filter !== 'all' && (filter === 'closed' ? !['cancelled', 'no_show'].includes(b.status) : b.status !== filter)) return false;
    if (barberF && b.barber_id !== barberF) return false;
    const s = q.trim().toLowerCase();
    return !s || [b.customer_name, b.customer_phone, b.code, ...b.items.map((i) => i.service_name)].some((x) => (x || '').toLowerCase().includes(s));
  }), [rows, filter, barberF, q]);

  const kpi = useMemo(() => {
    const r = rows || [];
    const active = r.filter((b) => ACTIVE.includes(b.status));
    return {
      count: active.length,
      expected: active.reduce((a, b) => a + Number(b.total_price), 0),
      done: r.filter((b) => b.status === 'completed').reduce((a, b) => a + Number(b.total_price), 0),
      pending: r.filter((b) => b.status === 'pending').length,
      noShow: r.filter((b) => b.status === 'no_show').length,
    };
  }, [rows]);

  const chart = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = addDays(date, i - 6);
    const items = week.filter((b) => localParts(b.starts_at, tz).date === d && ACTIVE.includes(b.status));
    return {
      key: d, label: fmtDay(d, lang, { weekday: 'short' }), highlight: d === date,
      value: items.reduce((a, b) => a + Number(b.total_price), 0), count: items.length,
    };
  }), [week, date, tz, lang]);

  async function setStatus(b, status) {
    if (status === 'cancelled' && !window.confirm(t('queue.cancelConfirm'))) return;
    setBusyId(b.id);
    const { error } = await supabase.from('bookings').update({ status }).eq('id', b.id);
    setBusyId(null);
    if (error) return toast(t(errorKey(error)), 'error');
    setRows((x) => x.map((r) => (r.id === b.id ? { ...r, status } : r)));
  }

  function waMessage(b) {
    const vars = { name: b.customer_name.split(' ')[0], shop: shop.name, time: `${fmtDay(localParts(b.starts_at, tz).date, lang)} ${fmtTime(b.starts_at, tz, lang)}`, link: `${SITE_URL}/b/${b.manage_token}`, barber: barberName(b.barber_id) };
    const key = b.status === 'completed' ? 'wa.review' : new Date(b.starts_at) - Date.now() < 6 * 36e5 ? 'wa.reminder' : 'wa.confirm';
    return waLink(b.customer_phone, t(key, vars));
  }

  const isToday = date === todayIn(tz);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setDate(addDays(date, -1))} aria-label="prev">{lang === 'ar' ? '→' : '←'}</Button>
          <div className="text-center min-w-[9rem]">
            <p className="font-extrabold text-white">{isToday ? t('common.today') : fmtDay(date, lang, { weekday: 'long' })}</p>
            <p className="text-xs text-slate-400">{fmtDay(date, lang, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
          <Button size="sm" onClick={() => setDate(addDays(date, 1))} aria-label="next">{lang === 'ar' ? '←' : '→'}</Button>
          {!isToday && <Button size="sm" variant="ghost" onClick={() => setDate(todayIn(tz))}>{t('common.today')}</Button>}
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="bg-ink-900 border border-ink-700 rounded-lg px-2 py-1.5 text-xs text-slate-300" />
        </div>
        <Button variant="gold" onClick={() => setWalkIn(true)} disabled={!barbers.length || !services.length}>+ {t('queue.addWalkIn')}</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[[t('queue.kpiBookings'), kpi.count, kpi.pending ? t('queue.kpiPending', { n: kpi.pending }) : ''],
          [t('queue.kpiExpected'), money(kpi.expected, lang), ''],
          [t('queue.kpiDone'), money(kpi.done, lang), ''],
          [t('queue.kpiNoShow'), kpi.noShow, '']].map(([l, v, s]) => (
          <Card key={l} className="p-4">
            <p className="text-xs text-slate-400">{l}</p>
            <p className="text-2xl font-extrabold text-white mt-1">{v}</p>
            {s && <p className="text-[11px] text-amber-400 mt-0.5">{s}</p>}
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="p-4 sm:p-5 space-y-4 lg:col-span-2">
          <div className="flex flex-wrap gap-1.5">
            {['all', 'pending', 'confirmed', 'completed', 'closed'].map((f) => (
              <button key={f} type="button" onClick={() => setFilter(f)}
                className={cx('px-3 py-1.5 rounded-lg text-xs font-bold', filter === f ? 'bg-amber-500 text-ink-950' : 'bg-ink-800 text-slate-300 hover:text-white')}>
                {t(`queue.f.${f}`)}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('queue.search')} />
            <Select value={barberF} onChange={(e) => setBarberF(e.target.value)}>
              <option value="">{t('queue.allBarbers')}</option>
              {barbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </div>

          {rows === null ? <Loading /> : shown.length === 0 ? (
            <Empty icon="🪑" title={t('queue.empty')} text={isToday ? t('queue.emptyHint') : ''} />
          ) : (
            <ul className="space-y-2.5">
              {shown.map((b) => (
                <li key={b.id} className={cx('rounded-xl border p-3.5 bg-ink-950/70', b.status === 'pending' ? 'border-amber-500/40' : 'border-ink-800',
                  ['cancelled', 'no_show'].includes(b.status) && 'opacity-60')}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <div className="text-center min-w-[4.5rem] bg-ink-850 rounded-lg px-2 py-1.5 border border-ink-800">
                        <p className="text-sm font-extrabold text-white">{fmtTime(b.starts_at, tz, lang)}</p>
                        <p className="text-[10px] text-slate-500">{fmtTime(b.ends_at, tz, lang)}</p>
                      </div>
                      <div>
                        <p className="font-bold text-white">{b.customer_name} <span className="text-xs text-slate-500 ltr">#{b.code}</span></p>
                        {b.customer_phone !== NO_PHONE && <a href={`tel:${b.customer_phone}`} className="text-xs text-slate-400 ltr hover:text-amber-400">{b.customer_phone}</a>}
                        <p className="text-xs text-slate-300 mt-0.5">{b.items.map((i) => i.service_name).join(' + ')}</p>
                        <p className="text-[11px] text-slate-500">💈 {barberName(b.barber_id)} · {money(b.total_price, lang)} · {t(`pay.${b.payment_method}`)}</p>
                        {b.notes && <p className="text-[11px] text-amber-200/80 mt-0.5">📝 {b.notes}</p>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge tone={STATUS_TONE[b.status]}>{t(`status.${b.status}`)}</Badge>
                      {b.source !== 'online' && <Badge tone="slate">{t(`source.${b.source}`)}</Badge>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {b.status === 'pending' && <Button size="sm" variant="success" loading={busyId === b.id} onClick={() => setStatus(b, 'confirmed')}>✓ {t('queue.confirm')}</Button>}
                    {['pending', 'confirmed'].includes(b.status) && <>
                      {b.status === 'confirmed' && <Button size="sm" variant="success" loading={busyId === b.id} onClick={() => setStatus(b, 'completed')}>✂ {t('queue.done')}</Button>}
                      {b.status === 'confirmed' && new Date(b.starts_at) < Date.now() && <Button size="sm" onClick={() => setStatus(b, 'no_show')}>{t('queue.noShow')}</Button>}
                      <Button size="sm" variant="danger" onClick={() => setStatus(b, 'cancelled')}>{t('queue.cancel')}</Button>
                    </>}
                    {['completed', 'no_show'].includes(b.status) && <Button size="sm" variant="ghost" onClick={() => setStatus(b, 'confirmed')}>↺ {t('queue.undo')}</Button>}
                    {b.status !== 'cancelled' && b.customer_phone !== NO_PHONE && <a href={waMessage(b)} target="_blank" rel="noreferrer"><Button size="sm" variant="wa">WhatsApp</Button></a>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5 space-y-3 h-fit">
          <div>
            <h3 className="font-bold text-white">{t('queue.weekTitle')}</h3>
            <p className="text-xs text-slate-400">{t('queue.weekSub')}</p>
          </div>
          <BarChart data={chart} lang={lang} />
          <p className="text-xs text-slate-400">{t('queue.weekTotal')}: <b className="text-amber-400">{money(chart.reduce((a, d) => a + d.value, 0), lang)}</b> · {chart.reduce((a, d) => a + d.count, 0)} {t('queue.bookingsWord')}</p>
        </Card>
      </div>

      {walkIn && <WalkInModal date={date} onClose={() => setWalkIn(false)} onDone={() => { setWalkIn(false); load(); }} />}
    </div>
  );
}

function WalkInModal({ date, onClose, onDone }) {
  const { shop, barbers, services } = useDash();
  const { t, lang } = useI18n();
  const toast = useToast();
  const tz = shop.timezone;
  const now = localParts(new Date(Math.ceil(Date.now() / 3e5) * 3e5).toISOString(), tz);
  const activeServices = services.filter((s) => s.is_active);
  const activeBarbers = barbers.filter((b) => b.is_active);
  const [f, setF] = useState({
    name: '', phone: '', barber: activeBarbers[0]?.id || '', services: activeServices[0] ? [activeServices[0].id] : [],
    time: date === now.date ? now.time : '12:00', source: 'walk_in', notes: '',
  });
  const [busy, setBusy] = useState(false);
  const total = activeServices.filter((s) => f.services.includes(s.id)).reduce((a, s) => a + Number(s.price), 0);

  async function save() {
    if (!f.services.length) return toast(t('err.INVALID_SERVICES'), 'error');
    setBusy(true);
    const { error } = await supabase.rpc('create_booking', {
      p_shop: shop.id, p_service_ids: f.services, p_starts_at: zonedToUtc(date, f.time, tz).toISOString(),
      p_name: f.name.trim() || t('queue.walkInGuest'), p_phone: f.phone.trim() || NO_PHONE,
      p_barber: f.barber, p_notes: f.notes, p_payment: 'at_shop', p_source: f.source,
    });
    setBusy(false);
    if (error) return toast(t(errorKey(error) === 'err.SLOT_TAKEN' ? 'err.BARBER_BUSY' : errorKey(error)), 'error');
    toast(t('queue.walkInAdded'));
    onDone();
  }

  return (
    <Modal open onClose={onClose} title={t('queue.addWalkIn')} subtitle={fmtDay(date, lang)}
      footer={<div className="flex items-center justify-between"><b className="text-amber-400">{money(total, lang)}</b><Button variant="gold" loading={busy} onClick={save}>{t('common.save')}</Button></div>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('book.name')}><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={t('queue.walkInGuest')} /></Field>
        <Field label={t('book.phone')}><Input type="tel" dir="ltr" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label={t('queue.barber')}>
          <Select value={f.barber} onChange={(e) => setF({ ...f, barber: e.target.value })}>
            {activeBarbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </Field>
        <Field label={t('queue.time')}><Input type="time" dir="ltr" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></Field>
        <Field label={t('queue.source')} className="col-span-2">
          <div className="flex gap-2">
            {['walk_in', 'phone'].map((s) => (
              <button key={s} type="button" onClick={() => setF({ ...f, source: s })}
                className={cx('flex-1 rounded-lg border py-2 text-sm font-bold', f.source === s ? 'border-amber-500 bg-amber-500/10 text-amber-300' : 'border-ink-700 text-slate-300')}>
                {t(`source.${s}`)}
              </button>
            ))}
          </div>
        </Field>
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-400 mb-1.5">{t('book.chooseServices')}</p>
        <div className="flex flex-wrap gap-2">
          {activeServices.map((s) => {
            const on = f.services.includes(s.id);
            return (
              <button key={s.id} type="button" onClick={() => setF({ ...f, services: on ? f.services.filter((x) => x !== s.id) : [...f.services, s.id] })}
                className={cx('px-3 py-1.5 rounded-lg border text-xs font-bold', on ? 'border-amber-500 bg-amber-500/10 text-amber-300' : 'border-ink-700 text-slate-300')}>
                {s.name} · {money(s.price, lang)}
              </button>
            );
          })}
        </div>
      </div>
      <Field label={t('book.notes')}><Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
    </Modal>
  );
}
