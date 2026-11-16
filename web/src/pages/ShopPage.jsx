import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase, mediaUrl } from '../lib/supabase';
import { useI18n } from '../lib/i18n';
import { money, waLink } from '../lib/format';
import { fmtClock } from '../lib/time';
import { Badge, Button, Card, Empty, Loading, Stars } from '../components/ui';
import BookingWizard from '../components/BookingWizard';
import { defaultCover } from './Home';

// Saturday-first week (common in Egypt)
export const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5];

export default function ShopPage() {
  const { slug } = useParams();
  const { t, lang } = useI18n();
  const [data, setData] = useState(undefined);
  const [booking, setBooking] = useState(null); // null | { serviceId }

  useEffect(() => {
    (async () => {
      const { data: shop } = await supabase.from('shops').select('*').eq('slug', slug).maybeSingle();
      if (!shop) { setData(null); return; }
      const [svc, brb, hrs, rev, dir] = await Promise.all([
        supabase.from('services').select('*').eq('shop_id', shop.id).eq('is_active', true).order('sort_order').order('created_at'),
        supabase.from('barbers').select('*').eq('shop_id', shop.id).eq('is_active', true).order('sort_order').order('created_at'),
        supabase.from('working_hours').select('*').eq('shop_id', shop.id),
        supabase.from('reviews').select('*').eq('shop_id', shop.id).order('created_at', { ascending: false }).limit(12),
        supabase.from('shops_directory').select('rating, reviews_count').eq('id', shop.id).maybeSingle(),
      ]);
      setData({ shop, services: svc.data || [], barbers: brb.data || [], hours: hrs.data || [], reviews: rev.data || [], stats: dir.data });
    })();
  }, [slug]);

  useEffect(() => { if (data?.shop) document.title = `${data.shop.name} | ${t('app.name')}`; }, [data, t]);

  if (data === undefined) return <Loading />;
  if (data === null) return <Empty icon="🔎" title={t('shop.notFound')} action={<Link to="/"><Button variant="gold">{t('nav.explore')}</Button></Link>} />;

  const { shop, services, barbers, hours, reviews, stats } = data;
  const canBook = services.length > 0 && barbers.length > 0;
  const hourOf = (d) => hours.find((h) => h.weekday === d);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <section className="relative rounded-2xl overflow-hidden border border-ink-800">
        <img src={mediaUrl(shop.cover_url) || defaultCover(shop.id)} alt="" className="w-full h-56 sm:h-72 object-cover opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/60 to-transparent" />
        <div className="absolute bottom-0 inset-x-0 p-5 sm:p-8 flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1.5">
            {shop.specialty && <Badge tone="amber">{t(`spec.${shop.specialty}`)}</Badge>}
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white">{shop.name}</h1>
            <p className="text-sm text-slate-300 flex flex-wrap items-center gap-x-3 gap-y-1">
              {shop.area && <span>📍 {shop.area}</span>}
              {stats?.reviews_count > 0 && <span className="flex items-center gap-1"><Stars value={stats.rating} /> {stats.rating} ({stats.reviews_count})</span>}
            </p>
          </div>
          {canBook && <Button variant="gold" size="lg" onClick={() => setBooking({})}>{t('shop.bookNow')}</Button>}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {shop.description && <Card className="p-5 text-sm text-slate-300 leading-7 whitespace-pre-line">{shop.description}</Card>}

          <Card className="p-5 space-y-3">
            <h2 className="font-extrabold text-white">{t('shop.services')}</h2>
            {services.length === 0 ? <p className="text-sm text-slate-400">{t('shop.noServices')}</p> : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {services.map((s) => (
                  <div key={s.id} className="bg-ink-950/70 border border-ink-800 rounded-xl p-4 flex flex-col justify-between gap-3">
                    <div>
                      <p className="font-bold text-white">{s.name}</p>
                      {s.description && <p className="text-xs text-slate-400 mt-1">{s.description}</p>}
                      <p className="text-xs text-slate-500 mt-1">⏱ {t('common.minutes', { n: s.duration_min })}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-amber-400">{money(s.price, lang)}</span>
                      {canBook && <Button size="sm" variant="gold" onClick={() => setBooking({ serviceId: s.id })}>{t('shop.book')}</Button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-5 space-y-3">
            <h2 className="font-extrabold text-white">{t('shop.team')}</h2>
            {barbers.length === 0 ? <p className="text-sm text-slate-400">{t('shop.noBarbers')}</p> : (
              <div className="flex flex-wrap gap-3">
                {barbers.map((b) => (
                  <div key={b.id} className="flex items-center gap-3 bg-ink-950/70 border border-ink-800 rounded-xl px-3 py-2.5">
                    <span className="w-10 h-10 rounded-full bg-ink-800 border border-amber-500/30 flex items-center justify-center font-bold text-amber-300">{b.name.slice(0, 1)}</span>
                    <div>
                      <p className="font-bold text-white text-sm">{b.name}</p>
                      {b.title && <p className="text-xs text-slate-400">{b.title}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-5 space-y-3">
            <h2 className="font-extrabold text-white">{t('shop.reviews')}</h2>
            {reviews.length === 0 ? <p className="text-sm text-slate-400">{t('shop.noReviews')}</p> : (
              <div className="space-y-3">
                {reviews.map((r) => (
                  <div key={r.id} className="border-b border-ink-800 pb-3 last:border-0">
                    <div className="flex items-center gap-2 text-sm"><Stars value={r.rating} /> <b className="text-white">{r.customer_name || t('shop.customer')}</b></div>
                    {r.comment && <p className="text-sm text-slate-300 mt-1">{r.comment}</p>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5 space-y-3">
            <h2 className="font-extrabold text-white">{t('shop.hours')}</h2>
            <ul className="text-sm divide-y divide-ink-800">
              {WEEK_ORDER.map((d) => {
                const h = hourOf(d);
                return (
                  <li key={d} className="flex justify-between py-2">
                    <span className="text-slate-400">{t(`day.${d}`)}</span>
                    {h ? <span className="text-white">{fmtClock(h.opens, lang)} – {fmtClock(h.closes, lang)}</span>
                      : <span className="text-rose-300">{t('shop.closed')}</span>}
                  </li>
                );
              })}
            </ul>
          </Card>
          <Card className="p-5 space-y-3 text-sm">
            <h2 className="font-extrabold text-white">{t('shop.contact')}</h2>
            {shop.address && <p className="text-slate-300">🏠 {shop.address}</p>}
            <div className="flex flex-wrap gap-2">
              {shop.phone && <a href={`tel:${shop.phone}`}><Button size="sm">📞 {t('shop.call')}</Button></a>}
              {shop.whatsapp && <a href={waLink(shop.whatsapp)} target="_blank" rel="noreferrer"><Button size="sm" variant="wa">WhatsApp</Button></a>}
              {shop.map_url && <a href={shop.map_url} target="_blank" rel="noreferrer"><Button size="sm">🗺 {t('shop.map')}</Button></a>}
            </div>
            <p className="text-xs text-slate-500">💵 {t('shop.payAtShop')}</p>
          </Card>
        </div>
      </div>

      {canBook && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 p-3 bg-ink-950/95 border-t border-ink-800 z-30 no-print">
          <Button variant="gold" size="lg" className="w-full" onClick={() => setBooking({})}>{t('shop.bookNow')}</Button>
        </div>
      )}
      <div className="h-16 lg:hidden" />

      {booking && (
        <BookingWizard shop={shop} services={services} barbers={barbers} hours={hours}
          initialServiceId={booking.serviceId} onClose={() => setBooking(null)} />
      )}
    </div>
  );
}
