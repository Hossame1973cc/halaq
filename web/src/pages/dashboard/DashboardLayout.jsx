import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useI18n } from '../../lib/i18n';
import { useAuth } from '../../lib/auth';
import { Badge, Button, Card, Empty, Loading, cx } from '../../components/ui';

export function DashboardIndex() {
  const { t } = useI18n();
  const { memberships, loading } = useAuth();
  if (loading) return <Loading />;
  if (memberships.length) return <Navigate to={`/dashboard/${memberships[0].shop.id}`} replace />;
  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <Card><Empty icon="💈" title={t('dash.noShopTitle')} text={t('dash.noShopText')}
        action={<div className="flex flex-wrap justify-center gap-2"><Link to="/start"><Button variant="gold">{t('home.addYourShop')}</Button></Link><Link to="/my"><Button>{t('nav.myBookings')}</Button></Link></div>} /></Card>
    </div>
  );
}

export const useDash = () => useOutletContext();

export default function DashboardLayout() {
  const { shopId } = useParams();
  const { t } = useI18n();
  const { memberships, loading } = useAuth();
  const nav = useNavigate();
  const [shop, setShop] = useState(undefined);
  const [barbers, setBarbers] = useState([]);
  const [services, setServices] = useState([]);

  const membership = memberships.find((m) => m.shop.id === shopId);
  const role = membership?.role;
  const isAdmin = role === 'owner' || role === 'manager';

  const reload = useCallback(async () => {
    const [s, b, v] = await Promise.all([
      supabase.from('shops').select('*').eq('id', shopId).maybeSingle(),
      supabase.from('barbers').select('*').eq('shop_id', shopId).order('sort_order').order('created_at'),
      supabase.from('services').select('*').eq('shop_id', shopId).order('sort_order').order('created_at'),
    ]);
    setShop(s.data || null);
    setBarbers(b.data || []);
    setServices(v.data || []);
  }, [shopId]);

  useEffect(() => { reload(); }, [reload]);

  if (loading || shop === undefined) return <Loading />;
  if (!membership || !shop) return <Navigate to="/dashboard" replace />;

  const tabs = [
    { to: '', label: t('dash.tab.queue'), icon: '📋', end: true },
    { to: 'services', label: t('dash.tab.services'), icon: '✂' },
    { to: 'team', label: t('dash.tab.team'), icon: '💈' },
    { to: 'hours', label: t('dash.tab.hours'), icon: '🕒' },
    { to: 'share', label: t('dash.tab.share'), icon: '🔳' },
    { to: 'settings', label: t('dash.tab.settings'), icon: '⚙️' },
  ];

  const trialDays = Math.ceil((new Date(shop.trial_ends_at) - Date.now()) / 864e5);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-400">{t('dash.kicker')}</p>
            {memberships.length > 1 ? (
              <select value={shopId} onChange={(e) => nav(`/dashboard/${e.target.value}`)}
                className="bg-transparent text-xl font-extrabold text-white outline-none">
                {memberships.map((m) => <option key={m.shop.id} value={m.shop.id} className="bg-ink-900">{m.shop.name}</option>)}
              </select>
            ) : <h1 className="text-xl font-extrabold text-white">{shop.name}</h1>}
          </div>
          {!shop.is_active && <Badge tone="red">{t('dash.hidden')}</Badge>}
        </div>
        <div className="flex items-center gap-2">
          {shop.plan === 'trial'
            ? <Badge tone={trialDays > 5 ? 'green' : 'amber'}>{trialDays > 0 ? t('dash.trialLeft', { n: trialDays }) : t('dash.trialEnded')}</Badge>
            : <Badge tone="amber">{t(`plans.${shop.plan}`)}</Badge>}
          <Link to={`/s/${shop.slug}`} target="_blank"><Button size="sm">{t('dash.viewPage')} ↗</Button></Link>
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto custom-scroll border-b border-ink-800 pb-2 no-print">
        {tabs.filter((x) => isAdmin || x.to === '' || x.to === 'share').map((x) => (
          <NavLink key={x.to} to={x.to} end={x.end}
            className={({ isActive }) => cx('shrink-0 px-3.5 py-2 rounded-lg text-sm font-semibold transition',
              isActive ? 'bg-ink-800 text-amber-400 border border-amber-500/30' : 'text-slate-400 hover:text-white')}>
            <span className="me-1">{x.icon}</span>{x.label}
          </NavLink>
        ))}
      </nav>

      <Outlet context={{ shop, setShop, barbers, services, reload, role, isAdmin }} />
    </div>
  );
}
