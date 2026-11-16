import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { IS_DEMO } from '../lib/supabase';
import { resetDemo } from '../lib/mockSupabase';
import { cx } from './ui';

export function Logo({ className }) {
  const { lang } = useI18n();
  return (
    <Link to="/" className={cx('flex items-center gap-2.5', className)}>
      <span className="w-9 h-9 rounded-xl gold-gradient flex items-center justify-center shadow-lg shadow-amber-500/20 text-ink-950 font-extrabold text-lg">✂</span>
      <span className="font-extrabold text-xl tracking-tight text-white">{lang === 'ar' ? 'حلاق' : 'Halaq'}</span>
    </Link>
  );
}

export default function Layout() {
  const { t, toggle, lang } = useI18n();
  const { user, memberships, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();

  const links = [
    { to: '/', label: t('nav.explore'), end: true },
    { to: '/my', label: t('nav.myBookings') },
    memberships.length
      ? { to: '/dashboard', label: t('nav.dashboard') }
      : { to: '/partners', label: t('nav.forBarbers') },
  ];

  const linkCls = ({ isActive }) => cx('px-3 py-2 rounded-lg text-sm font-semibold transition',
    isActive ? 'bg-ink-800 text-amber-400' : 'text-slate-300 hover:text-white');

  return (
    <div className="min-h-screen flex flex-col">
      {IS_DEMO && (
        <div className="bg-amber-500 text-ink-950 text-xs font-bold px-4 py-1.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 no-print">
          <span>{t('demo.banner')}</span>
          <button type="button" onClick={() => { if (window.confirm(t('demo.resetConfirm'))) resetDemo(); }} className="underline">{t('demo.reset')}</button>
        </div>
      )}
      <header className="sticky top-0 z-40 bg-ink-950/90 backdrop-blur-md border-b border-ink-800 no-print">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Logo />
          <nav className="hidden md:flex items-center gap-1">
            {links.map((l) => <NavLink key={l.to} to={l.to} end={l.end} className={linkCls}>{l.label}</NavLink>)}
          </nav>
          <div className="flex items-center gap-2">
            <button type="button" onClick={toggle} className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-ink-700 text-slate-300 hover:text-white">
              {lang === 'ar' ? 'EN' : 'ع'}
            </button>
            {user ? (
              <button type="button" onClick={async () => { await signOut(); nav('/'); }} className="hidden md:inline px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white">
                {t('nav.logout')}
              </button>
            ) : (
              <Link to="/login" className="hidden md:inline px-3 py-1.5 rounded-lg text-xs font-bold bg-ink-800 border border-ink-700 text-slate-200">{t('nav.login')}</Link>
            )}
            <button type="button" className="md:hidden w-9 h-9 rounded-lg bg-ink-800 text-slate-200" onClick={() => setOpen(!open)} aria-label="menu">☰</button>
          </div>
        </div>
        {open && (
          <div className="md:hidden border-t border-ink-800 px-4 py-3 flex flex-col gap-1" onClick={() => setOpen(false)}>
            {links.map((l) => <NavLink key={l.to} to={l.to} end={l.end} className={linkCls}>{l.label}</NavLink>)}
            {user
              ? <button type="button" onClick={async () => { await signOut(); nav('/'); }} className="text-start px-3 py-2 text-sm text-slate-400">{t('nav.logout')}</button>
              : <NavLink to="/login" className={linkCls}>{t('nav.login')}</NavLink>}
          </div>
        )}
      </header>
      <main className="flex-1 w-full">
        <Outlet />
      </main>
      <footer className="border-t border-ink-800 py-6 text-center text-xs text-slate-500 no-print">
        <p>© {new Date().getFullYear()} {t('app.name')} — {t('app.tagline')}</p>
        <p className="mt-1"><Link to="/partners" className="hover:text-amber-400">{t('nav.forBarbers')}</Link></p>
      </footer>
    </div>
  );
}
