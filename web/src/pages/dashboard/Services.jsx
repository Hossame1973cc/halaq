import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useI18n } from '../../lib/i18n';
import { errorKey } from '../../lib/format';
import { Button, Card, Empty, Field, Input, Toggle, useToast } from '../../components/ui';
import { useDash } from './DashboardLayout';

function ServiceRow({ s, onChange }) {
  const { t } = useI18n();
  const toast = useToast();
  const [f, setF] = useState({ name: s.name, description: s.description || '', duration_min: s.duration_min, price: s.price });
  const [busy, setBusy] = useState(false);
  const dirty = f.name !== s.name || f.description !== (s.description || '') || +f.duration_min !== s.duration_min || +f.price !== +s.price;

  async function save(patch) {
    setBusy(true);
    const { error } = await supabase.from('services').update(patch).eq('id', s.id);
    setBusy(false);
    if (error) return toast(t(errorKey(error)), 'error');
    toast(t('common.saved'));
    onChange();
  }
  async function remove() {
    if (!window.confirm(t('svc.deleteConfirm'))) return;
    const { error } = await supabase.from('services').delete().eq('id', s.id);
    if (error) return toast(t(errorKey(error)), 'error');
    onChange();
  }

  return (
    <div className={`rounded-xl border p-4 bg-ink-950/70 space-y-3 ${s.is_active ? 'border-ink-800' : 'border-ink-800 opacity-60'}`}>
      <div className="grid grid-cols-2 sm:grid-cols-[1fr_110px_120px] gap-3">
        <Field label={t('svc.name')} className="col-span-2 sm:col-span-1"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label={t('svc.duration')}><Input type="number" min={5} max={480} value={f.duration_min} onChange={(e) => setF({ ...f, duration_min: e.target.value })} /></Field>
        <Field label={t('svc.price')}><Input type="number" min={0} value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></Field>
      </div>
      <Field label={t('svc.description')}><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder={t('svc.descriptionPh')} /></Field>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Toggle checked={s.is_active} onChange={(v) => save({ is_active: v })} label={s.is_active ? t('svc.active') : t('svc.inactive')} />
        <div className="flex gap-2">
          <Button size="sm" variant="danger" onClick={remove}>{t('common.delete')}</Button>
          {dirty && <Button size="sm" variant="gold" loading={busy}
            onClick={() => save({ name: f.name.trim(), description: f.description.trim() || null, duration_min: +f.duration_min, price: +f.price })}>{t('common.save')}</Button>}
        </div>
      </div>
    </div>
  );
}

export default function Services() {
  const { shop, services, reload } = useDash();
  const { t } = useI18n();
  const toast = useToast();
  const [n, setN] = useState({ name: '', duration_min: 30, price: '' });
  const [busy, setBusy] = useState(false);

  async function add(e) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from('services').insert({ shop_id: shop.id, name: n.name.trim(), duration_min: +n.duration_min, price: +n.price || 0, sort_order: services.length });
    setBusy(false);
    if (error) return toast(t(errorKey(error)), 'error');
    setN({ name: '', duration_min: 30, price: '' });
    reload();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 space-y-3">
        {services.length === 0 ? <Card><Empty title={t('svc.empty')} /></Card> : services.map((s) => <ServiceRow key={`${s.id}-${s.price}-${s.name}-${s.is_active}`} s={s} onChange={reload} />)}
      </div>
      <Card className="p-5 h-fit">
        <form onSubmit={add} className="space-y-3">
          <h3 className="font-bold text-white">+ {t('svc.add')}</h3>
          <Field label={t('svc.name')}><Input required value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} placeholder={t('svc.namePh')} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('svc.duration')}><Input type="number" min={5} max={480} required value={n.duration_min} onChange={(e) => setN({ ...n, duration_min: e.target.value })} /></Field>
            <Field label={t('svc.price')}><Input type="number" min={0} required value={n.price} onChange={(e) => setN({ ...n, price: e.target.value })} /></Field>
          </div>
          <Button type="submit" variant="gold" className="w-full" loading={busy}>{t('svc.add')}</Button>
        </form>
      </Card>
    </div>
  );
}
