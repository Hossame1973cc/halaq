import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { errorKey, money, rememberBooking, saveCustomer, savedCustomer } from '../lib/format';
import { addDays, fmtDay, fmtTime, todayIn, weekdayOf } from '../lib/time';
import { Button, Field, Input, Modal, Select, Spinner, Textarea, cx, useToast } from './ui';

export default function BookingWizard({ shop, services, barbers, hours, initialServiceId, onClose }) {
  const { t, lang } = useI18n();
  const { user, profile } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const tz = shop.timezone;

  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState(initialServiceId ? [initialServiceId] : []);
  const [barberId, setBarberId] = useState(''); // '' = any barber
  const today = todayIn(tz);
  const days = useMemo(() => Array.from({ length: Math.min(shop.max_days_ahead + 1, 14) }, (_, i) => addDays(today, i)), [today, shop.max_days_ahead]);
  const openDays = new Set(hours.map((h) => h.weekday));
  const [date, setDate] = useState(() => days.find((d) => openDays.has(weekdayOf(d))) || today);
  const [slots, setSlots] = useState(null);
  const [slot, setSlot] = useState(null);
  const saved = savedCustomer();
  const [name, setName] = useState(saved.name || profile?.full_name || '');
  const [phone, setPhone] = useState(saved.phone || profile?.phone || '');
  const [notes, setNotes] = useState('');
  const [payment, setPayment] = useState('at_shop');
  const [busy, setBusy] = useState(false);

  const chosen = services.filter((s) => selected.includes(s.id));
  const duration = chosen.reduce((a, s) => a + s.duration_min, 0);
  const total = chosen.reduce((a, s) => a + Number(s.price), 0);

  useEffect(() => {
    if (step !== 2 || !duration) return;
    let alive = true;
    setSlots(null);
    setSlot(null);
    supabase.rpc('get_available_slots', { p_shop: shop.id, p_date: date, p_duration: duration, p_barber: barberId || null })
      .then(({ data, error }) => { if (alive) setSlots(error ? [] : data || []); });
    return () => { alive = false; };
  }, [step, date, duration, barberId, shop.id]);

  const toggle = (id) => setSelected((x) => (x.includes(id) ? x.filter((i) => i !== id) : [...x, id]));

  async function confirm() {
    if (name.trim().length < 2) return toast(t('err.NAME_REQUIRED'), 'error');
    if (phone.replace(/\D/g, '').length < 10) return toast(t('err.PHONE_REQUIRED'), 'error');
    setBusy(true);
    const { data, error } = await supabase.rpc('create_booking', {
      p_shop: shop.id, p_service_ids: selected, p_starts_at: slot.slot_start, p_name: name.trim(), p_phone: phone,
      p_barber: barberId || null, p_notes: notes, p_payment: payment, p_source: 'online',
    });
    setBusy(false);
    if (error) {
      const k = errorKey(error);
      toast(t(k), 'error');
      if (k === 'err.SLOT_TAKEN') setStep(2);
      return;
    }
    saveCustomer({ name: name.trim(), phone });
    rememberBooking(data.manage_token);
    nav(`/b/${data.manage_token}?new=1`);
  }

  const barberName = barbers.find((b) => b.id === barberId)?.name;

  const footer = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <span className="text-xs text-slate-400 block">{t('book.total')} · {t('common.minutes', { n: duration })}</span>
        <span className="text-xl font-extrabold text-amber-400">{money(total, lang)}</span>
      </div>
      <div className="flex gap-2">
        {step > 1 && <Button onClick={() => setStep(step - 1)}>{t('common.back')}</Button>}
        {step === 1 && <Button variant="gold" disabled={!selected.length} onClick={() => setStep(2)}>{t('common.next')}</Button>}
        {step === 2 && <Button variant="gold" disabled={!slot} onClick={() => setStep(3)}>{t('common.next')}</Button>}
        {step === 3 && <Button variant="gold" loading={busy} onClick={confirm}>{t('book.confirm')}</Button>}
      </div>
    </div>
  );

  return (
    <Modal open wide onClose={onClose} subtitle={shop.name} title={t(`book.step${step}`)} footer={footer}>
      <div className="flex gap-1.5">
        {[1, 2, 3].map((i) => <span key={i} className={cx('h-1.5 flex-1 rounded-full', i <= step ? 'bg-amber-500' : 'bg-ink-800')} />)}
      </div>

      {step === 1 && (
        <>
          <div>
            <p className="text-xs font-bold text-slate-400 mb-2">{t('book.chooseServices')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {services.map((s) => {
                const on = selected.includes(s.id);
                return (
                  <button key={s.id} type="button" onClick={() => toggle(s.id)}
                    className={cx('text-start rounded-xl border p-3 transition', on ? 'border-amber-500 bg-amber-500/10' : 'border-ink-700 bg-ink-950 hover:border-ink-700/80')}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-bold text-white text-sm">{s.name}</span>
                      <span className={cx('w-5 h-5 shrink-0 rounded-md border flex items-center justify-center text-xs', on ? 'bg-amber-500 border-amber-500 text-ink-950' : 'border-ink-700')}>{on && '✓'}</span>
                    </div>
                    <div className="flex justify-between text-xs mt-1.5">
                      <span className="text-slate-400">{t('common.minutes', { n: s.duration_min })}</span>
                      <span className="font-bold text-amber-400">{money(s.price, lang)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 mb-2">{t('book.chooseBarber')}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {[{ id: '', name: t('book.anyBarber'), title: t('book.anyBarberHint') }, ...barbers].map((b) => (
                <button key={b.id || 'any'} type="button" onClick={() => setBarberId(b.id)}
                  className={cx('text-start rounded-xl border p-3 transition', barberId === b.id ? 'border-amber-500 bg-amber-500/10' : 'border-ink-700 bg-ink-950')}>
                  <p className="font-bold text-white text-sm">{b.id ? '' : '⚡ '}{b.name}</p>
                  {b.title && <p className="text-[11px] text-slate-400 mt-0.5">{b.title}</p>}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div className="flex gap-2 overflow-x-auto custom-scroll pb-2 -mx-1 px-1">
            {days.map((d) => {
              const closed = !openDays.has(weekdayOf(d));
              return (
                <button key={d} type="button" disabled={closed} onClick={() => setDate(d)}
                  className={cx('shrink-0 w-16 rounded-xl border py-2 text-center transition disabled:opacity-30',
                    date === d ? 'border-amber-500 bg-amber-500 text-ink-950' : 'border-ink-700 bg-ink-950 text-slate-200')}>
                  <span className="block text-[11px] font-semibold">{d === today ? t('common.today') : fmtDay(d, lang, { weekday: 'short' })}</span>
                  <span className="block text-lg font-extrabold">{fmtDay(d, lang, { day: 'numeric' })}</span>
                  <span className="block text-[10px]">{fmtDay(d, lang, { month: 'short' })}</span>
                </button>
              );
            })}
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 mb-2">
              {t('book.availableTimes')} — {fmtDay(date, lang)}{barberName ? ` · ${barberName}` : ''}
            </p>
            {slots === null ? <div className="py-8 flex justify-center text-amber-400"><Spinner /></div>
              : slots.length === 0 ? <p className="text-sm text-slate-400 py-6 text-center">{t('book.noSlots')}</p> : (
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {slots.map((s) => (
                    <button key={s.slot_start} type="button" onClick={() => setSlot(s)}
                      className={cx('rounded-lg border py-2 text-sm font-bold transition',
                        slot?.slot_start === s.slot_start ? 'bg-amber-500 border-amber-500 text-ink-950' : 'border-ink-700 bg-ink-950 text-slate-200 hover:border-amber-500/50')}>
                      {fmtTime(s.slot_start, tz, lang)}
                    </button>
                  ))}
                </div>
              )}
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div className="bg-ink-950 border border-ink-800 rounded-xl p-4 text-sm space-y-1">
            <p className="text-white font-bold">🗓 {fmtDay(date, lang)} — <span>{fmtTime(slot.slot_start, tz, lang)}</span></p>
            <p className="text-slate-300">✂ {chosen.map((s) => s.name).join(' + ')}</p>
            <p className="text-slate-400">💈 {barberName || t('book.anyBarber')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={`${t('book.name')} *`}><Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></Field>
            <Field label={`${t('book.phone')} *`} hint={t('book.phoneHint')}>
              <Input type="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01xxxxxxxxx" autoComplete="tel" />
            </Field>
            <Field label={t('book.payment')}>
              <Select value={payment} onChange={(e) => setPayment(e.target.value)}>
                <option value="at_shop">{t('pay.at_shop')}</option>
                <option value="instapay">{t('pay.instapay')}</option>
                <option value="wallet">{t('pay.wallet')}</option>
              </Select>
            </Field>
            <Field label={t('book.notes')}><Textarea rows={1} maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('book.notesPh')} /></Field>
          </div>
          {!user && <p className="text-xs text-slate-500">{t('book.guestNote')}</p>}
        </>
      )}
    </Modal>
  );
}
