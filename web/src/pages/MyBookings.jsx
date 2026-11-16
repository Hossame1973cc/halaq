import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { guestBookings, money } from '../lib/format';
import { fmtDateTime } from '../lib/time';
import { Badge, Button, Card, Empty, Loading } from '../components/ui';
import { STATUS_TONE } from './ManageBooking';

export default function MyBookings() {
  const { t, lang } = useI18n();
  const { user, loading } = useAuth();
  const [list, setList] = useState(null);

  useEffect(() => {
    if (loading) return;
    (async () => {
      const map = new Map();
      if (user) {
        const { data } = await supabase.from('bookings')
          .select('id, code, status, starts_at, total_price, manage_token, shop:shops(name, slug, timezone), barber:barbers(name), items:booking_items(service_name)')
          .eq('customer_id', user.id).order('starts_at', { ascending: false }).limit(50);
        (data || []).forEach((b) => map.set(b.id, { ...b, items: b.items.map((i) => ({ name: i.service_name })) }));
      }
      const tokens = guestBookings().slice(0, 20);
      const res = await Promise.all(tokens.map((tk) => supabase.rpc('get_booking_by_token', { p_token: tk })));
      res.forEach(({ data }) => { if (data && !map.has(data.id)) map.set(data.id, data); });
      setList([...map.values()].sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at)));
    })();
  }, [user, loading]);

  if (list === null) return <Loading />;
  const now = Date.now();
  const upcoming = list.filter((b) => new Date(b.starts_at) >= now && ['pending', 'confirmed'].includes(b.status)).reverse();
  const past = list.filter((b) => !upcoming.includes(b));

  const Row = ({ b }) => (
    <Link to={`/b/${b.manage_token}`} className="card-surface rounded-2xl p-4 flex items-start justify-between gap-3 hover:border-amber-500/40 transition">
      <div className="space-y-1">
        <p className="font-extrabold text-white">{b.shop.name}</p>
        <p className="text-sm text-slate-300">{fmtDateTime(b.starts_at, b.shop.timezone, lang)}</p>
        <p className="text-xs text-slate-400">{b.items.map((i) => i.name).join(' + ')} · {b.barber.name}</p>
      </div>
      <div className="text-end space-y-1.5 shrink-0">
        <Badge tone={STATUS_TONE[b.status]}>{t(`status.${b.status}`)}</Badge>
        <p className="text-sm font-bold text-amber-400">{money(b.total_price, lang)}</p>
      </div>
    </Link>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-white">{t('nav.myBookings')}</h1>
        {!user && <p className="text-sm text-slate-400 mt-1">{t('my.guestHint')} <Link to="/login?next=/my" className="text-amber-400">{t('nav.login')}</Link></p>}
      </div>
      {list.length === 0 ? (
        <Card><Empty icon="📅" title={t('my.empty')} action={<Link to="/"><Button variant="gold">{t('home.cta')}</Button></Link>} /></Card>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-slate-400">{t('my.upcoming')} ({upcoming.length})</h2>
            {upcoming.length ? upcoming.map((b) => <Row key={b.id} b={b} />) : <p className="text-sm text-slate-500">{t('my.noUpcoming')}</p>}
          </section>
          {past.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-bold text-slate-400">{t('my.past')}</h2>
              {past.map((b) => <Row key={b.id} b={b} />)}
            </section>
          )}
        </>
      )}
    </div>
  );
}
