import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { supabase, SITE_URL } from '../lib/supabase';
import { useI18n } from '../lib/i18n';
import { downloadIcs, errorKey, money, rememberBooking, waLink } from '../lib/format';
import { fmtDateTime, fmtTime } from '../lib/time';
import { Badge, Button, Card, Empty, Loading, Textarea, cx, useToast } from '../components/ui';

export const STATUS_TONE = { pending: 'amber', confirmed: 'green', completed: 'blue', cancelled: 'red', no_show: 'violet' };

export default function ManageBooking() {
  const { token } = useParams();
  const [params] = useSearchParams();
  const isNew = params.get('new') === '1';
  const { t, lang } = useI18n();
  const toast = useToast();
  const [b, setB] = useState(undefined);
  const [busy, setBusy] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reviewed, setReviewed] = useState(false);

  const load = () => supabase.rpc('get_booking_by_token', { p_token: token }).then(({ data }) => setB(data || null));
  useEffect(() => { load(); rememberBooking(token); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  if (b === undefined) return <Loading />;
  if (b === null) return <Empty icon="🔎" title={t('manage.notFound')} action={<Link to="/"><Button variant="gold">{t('nav.explore')}</Button></Link>} />;

  const tz = b.shop.timezone;
  const link = `${SITE_URL}/b/${b.manage_token}`;

  async function cancel() {
    if (!window.confirm(t('manage.cancelConfirm'))) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('cancel_booking_by_token', { p_token: token });
    setBusy(false);
    if (error) return toast(t(errorKey(error)), 'error');
    setB(data);
    toast(t('manage.cancelled'));
  }

  async function review() {
    setBusy(true);
    const { error } = await supabase.rpc('submit_review', { p_token: token, p_rating: rating, p_comment: comment });
    setBusy(false);
    if (error) return toast(t(errorKey(error)), 'error');
    setReviewed(true);
    toast(t('manage.thanks'));
  }

  const waText = t('manage.waToShop', { code: b.code, time: fmtDateTime(b.starts_at, tz, lang) });

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
      {isNew && b.status !== 'cancelled' && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center space-y-1">
          <div className="text-4xl">✅</div>
          <h1 className="text-xl font-extrabold text-white">{b.status === 'pending' ? t('manage.newPending') : t('manage.newConfirmed')}</h1>
          <p className="text-sm text-emerald-200">{t('manage.saveLink')}</p>
        </div>
      )}

      <Card className="p-5 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-slate-400">{t('manage.code')} <b className="text-white ltr">#{b.code}</b></p>
            <Link to={`/s/${b.shop.slug}`} className="text-xl font-extrabold text-white hover:text-amber-400">{b.shop.name}</Link>
            {b.shop.area && <p className="text-xs text-slate-400">📍 {b.shop.area}</p>}
          </div>
          <Badge tone={STATUS_TONE[b.status]}>{t(`status.${b.status}`)}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-ink-950 rounded-xl p-3 border border-ink-800 col-span-2">
            <span className="text-xs text-slate-400 block">{t('manage.when')}</span>
            <span className="font-bold text-white">{fmtDateTime(b.starts_at, tz, lang)}</span>
            <span className="text-slate-400 text-xs"> – <span>{fmtTime(b.ends_at, tz, lang)}</span></span>
          </div>
          <div className="bg-ink-950 rounded-xl p-3 border border-ink-800">
            <span className="text-xs text-slate-400 block">{t('manage.barber')}</span>
            <span className="font-bold text-white">{b.barber.name}</span>
          </div>
          <div className="bg-ink-950 rounded-xl p-3 border border-ink-800">
            <span className="text-xs text-slate-400 block">{t('book.total')}</span>
            <span className="font-bold text-amber-400">{money(b.total_price, lang)}</span>
            <span className="text-[11px] text-slate-500 block">{t(`pay.${b.payment_method}`)}</span>
          </div>
        </div>

        <ul className="text-sm divide-y divide-ink-800">
          {b.items.map((i, n) => (
            <li key={n} className="flex justify-between py-2"><span className="text-slate-300">{i.name}</span><span className="text-slate-400">{money(i.price, lang)}</span></li>
          ))}
        </ul>
        {b.notes && <p className="text-xs text-slate-400">📝 {b.notes}</p>}

        <div className="flex flex-wrap gap-2 pt-1">
          {['pending', 'confirmed'].includes(b.status) && (
            <Button size="sm" onClick={() => downloadIcs({
              title: `${t('app.name')} — ${b.shop.name}`, start: b.starts_at, end: b.ends_at,
              location: [b.shop.name, b.shop.address].filter(Boolean).join(' - '), description: link,
            })}>📅 {t('manage.addCalendar')}</Button>
          )}
          {(b.shop.whatsapp || b.shop.phone) && (
            <a href={waLink(b.shop.whatsapp || b.shop.phone, waText)} target="_blank" rel="noreferrer"><Button size="sm" variant="wa">WhatsApp {t('manage.shop')}</Button></a>
          )}
          {b.shop.map_url && <a href={b.shop.map_url} target="_blank" rel="noreferrer"><Button size="sm">🗺 {t('shop.map')}</Button></a>}
          <Button size="sm" onClick={() => { navigator.clipboard?.writeText(link); toast(t('common.copied')); }}>🔗 {t('manage.copyLink')}</Button>
          {b.can_cancel && <Button size="sm" variant="danger" loading={busy} onClick={cancel}>{t('manage.cancel')}</Button>}
        </div>
        {['pending', 'confirmed'].includes(b.status) && !b.can_cancel && (
          <p className="text-xs text-slate-500">{t('manage.cutoff', { n: b.shop.cancel_cutoff_min })}</p>
        )}
      </Card>

      {b.can_review && !reviewed && (
        <Card className="p-5 space-y-3">
          <h2 className="font-extrabold text-white">{t('manage.rateTitle')}</h2>
          <div className="flex gap-1" dir="ltr">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setRating(n)} className={cx('text-3xl transition', n <= rating ? 'text-amber-400' : 'text-ink-700')}>★</button>
            ))}
          </div>
          <Textarea maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t('manage.ratePh')} />
          <Button variant="gold" loading={busy} onClick={review}>{t('manage.rateSend')}</Button>
        </Card>
      )}

      <div className="text-center">
        <Link to={`/s/${b.shop.slug}`} className="text-sm text-amber-400 hover:underline">{t('manage.bookAgain')}</Link>
      </div>
    </div>
  );
}
