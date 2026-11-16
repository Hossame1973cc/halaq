import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { errorKey, slugify } from '../lib/format';
import { Button, Card, Field, Input, useToast } from '../components/ui';

export default function Onboarding() {
  const { t } = useI18n();
  const { profile, refresh } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [f, setF] = useState({ name: '', slug: '', area: '', phone: '', barber: '' });
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugOk, setSlugOk] = useState(null);
  const [svc, setSvc] = useState([
    { key: 'haircut', duration: 30, price: 150 },
    { key: 'beard', duration: 20, price: 80 },
    { key: 'combo', duration: 45, price: 200 },
  ]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (profile) setF((x) => ({ ...x, phone: x.phone || profile.phone || '', barber: x.barber || profile.full_name || '' }));
  }, [profile]);

  useEffect(() => {
    if (!f.slug) { setSlugOk(null); return undefined; }
    const id = setTimeout(async () => {
      const { data } = await supabase.rpc('is_slug_available', { p_slug: f.slug });
      setSlugOk(Boolean(data));
    }, 350);
    return () => clearTimeout(id);
  }, [f.slug]);

  const set = (k) => (e) => {
    const v = e.target.value;
    setF((x) => {
      const n = { ...x, [k]: v };
      if (k === 'name' && !slugTouched) n.slug = slugify(v) || '';
      return n;
    });
  };

  async function submit(e) {
    e.preventDefault();
    let slug = f.slug || `shop-${Math.random().toString(36).slice(2, 7)}`;
    if (slugOk === false) return toast(t('err.SLUG_TAKEN'), 'error');
    setBusy(true);
    const { data: shop, error } = await supabase.rpc('create_shop', { p_name: f.name.trim(), p_slug: slug, p_area: f.area.trim() || null, p_phone: f.phone.trim() || null });
    if (error) { setBusy(false); return toast(t(errorKey(error)), 'error'); }
    const id = shop.id;
    const r1 = await supabase.from('barbers').insert({ shop_id: id, name: f.barber.trim() || t('onb.barberDefault'), sort_order: 0 });
    const r2 = await supabase.from('services').insert(svc.filter((s) => s.price !== '').map((s, i) => ({
      shop_id: id, name: t(`onb.svc.${s.key}`), duration_min: Number(s.duration), price: Number(s.price), sort_order: i,
    })));
    setBusy(false);
    if (r1.error || r2.error) toast(t('err.GENERIC'), 'error');
    await refresh();
    toast(t('onb.done'));
    nav(`/dashboard/${id}/share`, { replace: true });
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Card className="p-6 sm:p-8 space-y-6">
        <div>
          <p className="text-xs font-bold text-amber-400">{t('onb.kicker')}</p>
          <h1 className="text-2xl font-extrabold text-white">{t('onb.title')}</h1>
          <p className="text-sm text-slate-400 mt-1">{t('onb.sub')}</p>
        </div>
        <form onSubmit={submit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={`${t('onb.shopName')} *`}><Input required minLength={2} maxLength={80} value={f.name} onChange={set('name')} placeholder={t('onb.shopNamePh')} /></Field>
            <Field label={t('onb.area')}><Input value={f.area} onChange={set('area')} placeholder={t('onb.areaPh')} /></Field>
            <Field label={t('onb.slug')} hint={slugOk === false ? `❌ ${t('err.SLUG_TAKEN')}` : slugOk ? `✅ ${t('onb.slugOk')}` : t('onb.slugHint')} className="sm:col-span-2">
              <div className="flex items-stretch" dir="ltr">
                <span className="px-3 flex items-center rounded-s-xl bg-ink-800 border border-ink-700 border-e-0 text-xs text-slate-400">/s/</span>
                <Input className="rounded-s-none" value={f.slug} placeholder="my-barber-shop"
                  onChange={(e) => { setSlugTouched(true); setF({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }); }} />
              </div>
            </Field>
            <Field label={t('onb.phone')}><Input type="tel" dir="ltr" value={f.phone} onChange={set('phone')} placeholder="01xxxxxxxxx" /></Field>
            <Field label={t('onb.firstBarber')}><Input value={f.barber} onChange={set('barber')} /></Field>
          </div>

          <div>
            <p className="text-xs font-bold text-slate-400 mb-2">{t('onb.starterServices')}</p>
            <div className="space-y-2">
              {svc.map((s, i) => (
                <div key={s.key} className="grid grid-cols-[1fr_90px_100px] gap-2 items-center">
                  <span className="text-sm text-white">{t(`onb.svc.${s.key}`)}</span>
                  <Input type="number" min={5} value={s.duration} onChange={(e) => setSvc(svc.map((x, j) => (j === i ? { ...x, duration: e.target.value } : x)))} title={t('svc.duration')} />
                  <Input type="number" min={0} value={s.price} onChange={(e) => setSvc(svc.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} title={t('svc.price')} />
                </div>
              ))}
              <p className="text-[11px] text-slate-500">{t('onb.servicesHint')}</p>
            </div>
          </div>

          <Button type="submit" variant="gold" size="lg" className="w-full" loading={busy}>✨ {t('onb.create')}</Button>
          <p className="text-xs text-center text-slate-500">{t('onb.trial')}</p>
        </form>
      </Card>
    </div>
  );
}
