import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase, authRedirect, IS_DEMO } from '../lib/supabase';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { errorKey } from '../lib/format';
import { Button, Card, Field, Input, useToast } from '../components/ui';
import { Logo } from '../components/Layout';

function Shell({ title, sub, children }) {
  return (
    <div className="max-w-md mx-auto px-4 py-10">
      <Card className="p-6 sm:p-8 space-y-5">
        <Logo />
        <div>
          <h1 className="text-xl font-extrabold text-white">{title}</h1>
          {sub && <p className="text-sm text-slate-400 mt-1">{sub}</p>}
        </div>
        {children}
      </Card>
    </div>
  );
}

export function Login() {
  const { t } = useI18n();
  const { user, refresh } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/dashboard';
  const reset = params.get('reset') === '1';
  const [email, setEmail] = useState(IS_DEMO ? 'demo@halaq.app' : '');
  const [password, setPassword] = useState(IS_DEMO ? 'demo123' : '');
  const [busy, setBusy] = useState(false);

  if (reset && user) return <NewPassword />;
  if (user) return <Navigate to={next} replace />;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) return toast(t(errorKey(error)), 'error');
    await refresh();
    nav(next, { replace: true });
  }

  async function forgot() {
    if (!email.includes('@')) return toast(t('auth.enterEmail'), 'error');
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: authRedirect('/login?reset=1') });
    if (error) return toast(t(errorKey(error)), 'error');
    toast(t('auth.resetSent'));
  }

  return (
    <Shell title={t('auth.loginTitle')} sub={t('auth.loginSub')}>
      {IS_DEMO && <p className="text-xs rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 p-3">{t('demo.login')}</p>}
      <form onSubmit={submit} className="space-y-4">
        <Field label={t('auth.email')}><Input type="email" dir="ltr" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></Field>
        <Field label={t('auth.password')}><Input type="password" dir="ltr" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></Field>
        <Button type="submit" variant="gold" className="w-full" loading={busy}>{t('nav.login')}</Button>
      </form>
      <div className="flex justify-between text-sm">
        <button type="button" onClick={forgot} className="text-slate-400 hover:text-white">{t('auth.forgot')}</button>
        <Link to={`/signup?next=${encodeURIComponent(next)}`} className="text-amber-400 font-semibold">{t('auth.createAccount')}</Link>
      </div>
    </Shell>
  );
}

function NewPassword() {
  const { t } = useI18n();
  const toast = useToast();
  const nav = useNavigate();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast(t(errorKey(error)), 'error');
    toast(t('auth.passwordUpdated'));
    nav('/dashboard', { replace: true });
  }
  return (
    <Shell title={t('auth.newPassword')}>
      <form onSubmit={submit} className="space-y-4">
        <Field label={t('auth.password')} hint={t('auth.passwordHint')}><Input type="password" dir="ltr" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <Button type="submit" variant="gold" className="w-full" loading={busy}>{t('common.save')}</Button>
      </form>
    </Shell>
  );
}

export function Signup() {
  const { t } = useI18n();
  const { user, refresh } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/start';
  const [f, setF] = useState({ full_name: '', phone: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  if (user) return <Navigate to={next} replace />;
  if (checkEmail) {
    return <Shell title={t('auth.checkEmailTitle')} sub={t('auth.checkEmailText', { email: f.email })}><Link to="/login"><Button className="w-full">{t('nav.login')}</Button></Link></Shell>;
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: f.email.trim(), password: f.password,
      options: { data: { full_name: f.full_name.trim(), phone: f.phone.trim() }, emailRedirectTo: authRedirect(next) },
    });
    setBusy(false);
    if (error) return toast(t(errorKey(error)), 'error');
    if (!data.session) { setCheckEmail(true); return; }
    await refresh();
    nav(next, { replace: true });
  }

  return (
    <Shell title={t('auth.signupTitle')} sub={t('auth.signupSub')}>
      <form onSubmit={submit} className="space-y-4">
        <Field label={t('auth.fullName')}><Input required value={f.full_name} onChange={set('full_name')} autoComplete="name" /></Field>
        <Field label={t('book.phone')}><Input type="tel" dir="ltr" required value={f.phone} onChange={set('phone')} placeholder="01xxxxxxxxx" /></Field>
        <Field label={t('auth.email')}><Input type="email" dir="ltr" required value={f.email} onChange={set('email')} autoComplete="email" /></Field>
        <Field label={t('auth.password')} hint={t('auth.passwordHint')}><Input type="password" dir="ltr" minLength={6} required value={f.password} onChange={set('password')} autoComplete="new-password" /></Field>
        <Button type="submit" variant="gold" className="w-full" loading={busy}>{t('auth.createAccount')}</Button>
      </form>
      <p className="text-sm text-center text-slate-400">{t('auth.haveAccount')} <Link to={`/login?next=${encodeURIComponent(next)}`} className="text-amber-400 font-semibold">{t('nav.login')}</Link></p>
    </Shell>
  );
}
