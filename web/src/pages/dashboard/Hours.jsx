import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useI18n } from '../../lib/i18n';
import { errorKey } from '../../lib/format';
import { fmtDateTime, todayIn, zonedToUtc } from '../../lib/time';
import { Button, Card, Field, Input, Select, Toggle, useToast } from '../../components/ui';
import { WEEK_ORDER } from '../ShopPage';
import { useDash } from './DashboardLayout';

export default function Hours() {
  const { shop, barbers } = useDash();
  const { t, lang } = useI18n();
  const toast = useToast();
  const tz = shop.timezone;
  const [days, setDays] = useState(null);
  const [off, setOff] = useState([]);
  const [busy, setBusy] = useState(false);
  const today = todayIn(tz);
  const [n, setN] = useState({ barber: '', from: `${today}T12:00`, to: `${today}T23:00`, reason: '' });

  async function load() {
    const [h, o] = await Promise.all([
      supabase.from('working_hours').select('*').eq('shop_id', shop.id),
      supabase.from('time_off').select('*').eq('shop_id', shop.id).gte('ends_at', new Date().toISOString()).order('starts_at'),
    ]);
    const map = {};
    for (let d = 0; d < 7; d += 1) {
      const r = (h.data || []).find((x) => x.weekday === d);
      map[d] = r ? { open: true, opens: r.opens.slice(0, 5), closes: r.closes.slice(0, 5) } : { open: false, opens: '12:00', closes: '23:00' };
    }
    setDays(map);
    setOff(o.data || []);
  }
  useEffect(() => { load(); }, [shop.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveHours() {
    setBusy(true);
    const del = await supabase.from('working_hours').delete().eq('shop_id', shop.id);
    const rows = Object.entries(days).filter(([, v]) => v.open).map(([d, v]) => ({ shop_id: shop.id, weekday: +d, opens: v.opens, closes: v.closes }));
    const ins = rows.length ? await supabase.from('working_hours').insert(rows) : { error: null };
    setBusy(false);
    if (del.error || ins.error) return toast(t(errorKey(del.error || ins.error)), 'error');
    toast(t('common.saved'));
  }

  async function addOff(e) {
    e.preventDefault();
    const [fd, ft] = n.from.split('T');
    const [td, tt] = n.to.split('T');
    const starts = zonedToUtc(fd, ft, tz);
    const ends = zonedToUtc(td, tt, tz);
    if (ends <= starts) return toast(t('hours.badRange'), 'error');
    const { error } = await supabase.from('time_off').insert({ shop_id: shop.id, barber_id: n.barber || null, starts_at: starts.toISOString(), ends_at: ends.toISOString(), reason: n.reason.trim() || null });
    if (error) return toast(t(errorKey(error)), 'error');
    toast(t('common.saved'));
    load();
  }

  async function removeOff(id) {
    await supabase.from('time_off').delete().eq('id', id);
    load();
  }

  if (!days) return null;
  const set = (d, patch) => setDays({ ...days, [d]: { ...days[d], ...patch } });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <Card className="p-5 space-y-4">
        <div>
          <h3 className="font-bold text-white">{t('hours.title')}</h3>
          <p className="text-xs text-slate-400">{t('hours.sub')}</p>
        </div>
        <ul className="space-y-2">
          {WEEK_ORDER.map((d) => (
            <li key={d} className="grid grid-cols-[110px_1fr] sm:grid-cols-[130px_1fr] items-center gap-2">
              <Toggle checked={days[d].open} onChange={(v) => set(d, { open: v })} label={t(`day.${d}`)} />
              {days[d].open ? (
                <div className="flex items-center gap-2" dir="ltr">
                  <Input type="time" value={days[d].opens} onChange={(e) => set(d, { opens: e.target.value })} className="py-1.5" />
                  <span className="text-slate-500">→</span>
                  <Input type="time" value={days[d].closes} onChange={(e) => set(d, { closes: e.target.value })} className="py-1.5" />
                </div>
              ) : <span className="text-sm text-rose-300">{t('shop.closed')}</span>}
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-slate-500">{t('hours.midnight')}</p>
        <Button variant="gold" loading={busy} onClick={saveHours}>{t('common.save')}</Button>
      </Card>

      <Card className="p-5 space-y-4">
        <div>
          <h3 className="font-bold text-white">{t('hours.offTitle')}</h3>
          <p className="text-xs text-slate-400">{t('hours.offSub')}</p>
        </div>
        <form onSubmit={addOff} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label={t('hours.who')} className="sm:col-span-2">
            <Select value={n.barber} onChange={(e) => setN({ ...n, barber: e.target.value })}>
              <option value="">{t('hours.wholeShop')}</option>
              {barbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          <Field label={t('hours.from')}><Input type="datetime-local" dir="ltr" required value={n.from} onChange={(e) => setN({ ...n, from: e.target.value })} /></Field>
          <Field label={t('hours.to')}><Input type="datetime-local" dir="ltr" required value={n.to} onChange={(e) => setN({ ...n, to: e.target.value })} /></Field>
          <Field label={t('hours.reason')} className="sm:col-span-2"><Input value={n.reason} onChange={(e) => setN({ ...n, reason: e.target.value })} placeholder={t('hours.reasonPh')} /></Field>
          <Button type="submit" variant="gold" className="sm:col-span-2">{t('hours.addOff')}</Button>
        </form>
        <ul className="divide-y divide-ink-800">
          {off.length === 0 && <li className="text-sm text-slate-500 py-2">{t('hours.noOff')}</li>}
          {off.map((o) => (
            <li key={o.id} className="py-2.5 flex items-start justify-between gap-2 text-sm">
              <div>
                <p className="font-bold text-white">{o.barber_id ? barbers.find((b) => b.id === o.barber_id)?.name : t('hours.wholeShop')}{o.reason ? ` — ${o.reason}` : ''}</p>
                <p className="text-xs text-slate-400">{fmtDateTime(o.starts_at, tz, lang)} → {fmtDateTime(o.ends_at, tz, lang)}</p>
              </div>
              <Button size="sm" variant="danger" onClick={() => removeOff(o.id)}>{t('common.delete')}</Button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
