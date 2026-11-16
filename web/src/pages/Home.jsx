import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, mediaUrl } from '../lib/supabase';
import { useI18n } from '../lib/i18n';
import { money } from '../lib/format';
import { Button, Card, Empty, Loading, Stars, cx } from '../components/ui';
import hero from '../assets/hero.webp';
import cover1 from '../assets/cover-1.webp';
import cover2 from '../assets/cover-2.webp';

export const SPECIALTIES = ['fade', 'beard', 'classic', 'vip', 'kids'];
export const defaultCover = (id = '') => (id.charCodeAt(0) % 2 ? cover1 : cover2);

export default function Home() {
  const { t, lang } = useI18n();
  const [shops, setShops] = useState(null);
  const [q, setQ] = useState('');
  const [spec, setSpec] = useState('all');
  const [error, setError] = useState(false);

  useEffect(() => {
    supabase.from('shops_directory').select('*').order('rating', { ascending: false }).limit(200)
      .then(({ data, error: e }) => { if (e) setError(true); setShops(data || []); });
  }, []);

  const filtered = useMemo(() => {
    if (!shops) return [];
    const s = q.trim().toLowerCase();
    return shops.filter((x) => (spec === 'all' || x.specialty === spec)
      && (!s || [x.name, x.area, x.description].some((f) => (f || '').toLowerCase().includes(s))));
  }, [shops, q, spec]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-8">
      <section className="relative rounded-2xl overflow-hidden border border-ink-800 shadow-2xl">
        <img src={hero} alt="" className="w-full h-72 sm:h-80 object-cover opacity-45" />
        <div className="absolute inset-0 bg-gradient-to-l rtl:bg-gradient-to-r from-transparent via-ink-950/85 to-ink-950" />
        <div className="absolute inset-0 p-6 sm:p-10 flex flex-col justify-center max-w-2xl space-y-4">
          <span className="inline-flex w-fit px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold">
            ⚡ {t('home.badge')}
          </span>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white leading-tight">
            {t('home.title1')} <span className="text-amber-400">{t('home.title2')}</span>
          </h1>
          <p className="text-slate-300 text-sm sm:text-base">{t('home.subtitle')}</p>
          <div className="flex flex-wrap gap-3">
            <a href="#shops"><Button variant="gold">{t('home.cta')}</Button></a>
            <Link to="/my"><Button>{t('nav.myBookings')}</Button></Link>
          </div>
        </div>
      </section>

      <section id="shops" className="space-y-5 scroll-mt-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-white">{t('home.shopsTitle')}</h2>
            <p className="text-sm text-slate-400">{t('home.shopsSub')}</p>
          </div>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('home.search')}
            className="w-full sm:w-72 bg-ink-900 border border-ink-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none" />
        </div>
        <div className="flex flex-wrap gap-2">
          {['all', ...SPECIALTIES].map((s) => (
            <button key={s} type="button" onClick={() => setSpec(s)}
              className={cx('px-3.5 py-1.5 rounded-full text-xs font-bold border transition',
                spec === s ? 'bg-amber-500 text-ink-950 border-amber-500' : 'border-ink-700 text-slate-300 hover:text-white')}>
              {t(`spec.${s}`)}
            </button>
          ))}
        </div>

        {shops === null ? <Loading /> : error ? (
          <Empty icon="⚠️" title={t('err.NETWORK')} />
        ) : filtered.length === 0 ? (
          <Card><Empty title={t('home.noShops')} text={t('home.noShopsText')}
            action={<Link to="/partners"><Button variant="gold">{t('home.addYourShop')}</Button></Link>} /></Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((s) => (
              <Link key={s.id} to={`/s/${s.slug}`} className="group card-surface rounded-2xl overflow-hidden hover:border-amber-500/40 transition">
                <div className="relative h-40 overflow-hidden">
                  <img src={mediaUrl(s.cover_url) || defaultCover(s.id)} alt="" loading="lazy"
                    className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition duration-500" />
                  {s.specialty && <span className="absolute top-3 start-3 text-[11px] font-bold px-2 py-0.5 rounded-full bg-ink-950/80 text-amber-300 border border-amber-500/30">{t(`spec.${s.specialty}`)}</span>}
                </div>
                <div className="p-4 space-y-1.5">
                  <h3 className="font-extrabold text-white text-lg leading-snug">{s.name}</h3>
                  {s.area && <p className="text-xs text-slate-400">📍 {s.area}</p>}
                  <div className="flex items-center justify-between pt-1">
                    <span className="flex items-center gap-1.5 text-xs text-slate-300">
                      {s.reviews_count > 0 ? <><Stars value={s.rating} /> {s.rating} ({s.reviews_count})</> : <span className="text-emerald-300">{t('home.new')}</span>}
                    </span>
                    {s.min_price != null && <span className="text-xs text-slate-400">{t('home.from')} <b className="text-amber-400">{money(s.min_price, lang)}</b></span>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="card-surface rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-amber-500/20">
        <div>
          <h3 className="text-lg font-extrabold text-white">💈 {t('home.barberCtaTitle')}</h3>
          <p className="text-sm text-slate-400 mt-1">{t('home.barberCtaText')}</p>
        </div>
        <Link to="/partners"><Button variant="gold">{t('home.addYourShop')}</Button></Link>
      </section>
    </div>
  );
}
