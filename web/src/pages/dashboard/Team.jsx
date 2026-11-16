import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useI18n } from '../../lib/i18n';
import { errorKey } from '../../lib/format';
import { Button, Card, Empty, Field, Input, Toggle, useToast } from '../../components/ui';
import { useDash } from './DashboardLayout';

export default function Team() {
  const { shop, barbers, reload } = useDash();
  const { t } = useI18n();
  const toast = useToast();
  const [n, setN] = useState({ name: '', title: '' });
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);

  async function add(e) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from('barbers').insert({ shop_id: shop.id, name: n.name.trim(), title: n.title.trim() || null, sort_order: barbers.length });
    setBusy(false);
    if (error) return toast(t(errorKey(error)), 'error');
    setN({ name: '', title: '' });
    reload();
  }
  async function update(id, patch) {
    const { error } = await supabase.from('barbers').update(patch).eq('id', id);
    if (error) return toast(t(errorKey(error)), 'error');
    setEdit(null);
    reload();
  }
  async function remove(b) {
    if (!window.confirm(t('team.deleteConfirm', { name: b.name }))) return;
    const { error } = await supabase.from('barbers').delete().eq('id', b.id);
    if (error) return toast(t(errorKey(error) === 'err.IN_USE' ? 'team.hasBookings' : errorKey(error)), 'error');
    reload();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 space-y-3">
        {barbers.length === 0 ? <Card><Empty icon="💈" title={t('team.empty')} /></Card> : barbers.map((b) => (
          <Card key={b.id} className={`p-4 ${b.is_active ? '' : 'opacity-60'}`}>
            {edit?.id === b.id ? (
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
                <Field label={t('team.name')}><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
                <Field label={t('team.title')}><Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setEdit(null)}>{t('common.cancel')}</Button>
                  <Button size="sm" variant="gold" onClick={() => update(b.id, { name: edit.name.trim(), title: edit.title.trim() || null })}>{t('common.save')}</Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="w-11 h-11 rounded-full bg-ink-800 border border-amber-500/30 flex items-center justify-center font-bold text-amber-300">{b.name.slice(0, 1)}</span>
                  <div>
                    <p className="font-bold text-white">{b.name}</p>
                    <p className="text-xs text-slate-400">{b.title || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Toggle checked={b.is_active} onChange={(v) => update(b.id, { is_active: v })} label={b.is_active ? t('team.available') : t('team.off')} />
                  <Button size="sm" onClick={() => setEdit({ id: b.id, name: b.name, title: b.title || '' })}>{t('common.edit')}</Button>
                  <Button size="sm" variant="danger" onClick={() => remove(b)}>{t('common.delete')}</Button>
                </div>
              </div>
            )}
          </Card>
        ))}
        <p className="text-xs text-slate-500">{t('team.hint')}</p>
      </div>
      <Card className="p-5 h-fit">
        <form onSubmit={add} className="space-y-3">
          <h3 className="font-bold text-white">+ {t('team.add')}</h3>
          <Field label={t('team.name')}><Input required value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} /></Field>
          <Field label={t('team.title')}><Input value={n.title} onChange={(e) => setN({ ...n, title: e.target.value })} placeholder={t('team.titlePh')} /></Field>
          <Button type="submit" variant="gold" className="w-full" loading={busy}>{t('team.add')}</Button>
        </form>
      </Card>
    </div>
  );
}
