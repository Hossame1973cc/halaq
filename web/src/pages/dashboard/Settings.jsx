import { useState } from 'react';
import { supabase, mediaUrl } from '../../lib/supabase';
import { useI18n } from '../../lib/i18n';
import { errorKey } from '../../lib/format';
import { Button, Card, Field, Input, Select, Textarea, Toggle, useToast } from '../../components/ui';
import { SPECIALTIES, defaultCover } from '../Home';
import { useDash } from './DashboardLayout';

const FIELDS = ['name', 'area', 'address', 'phone', 'whatsapp', 'specialty', 'description', 'map_url',
  'slot_step_min', 'min_notice_min', 'max_days_ahead', 'cancel_cutoff_min', 'auto_confirm', 'is_active'];

export default function Settings() {
  const { shop, setShop } = useDash();
  const { t } = useI18n();
  const toast = useToast();
  const [f, setF] = useState(() => Object.fromEntries(FIELDS.map((k) => [k, shop[k] ?? ''])));
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    const patch = { ...f };
    ['area', 'address', 'phone', 'whatsapp', 'specialty', 'description', 'map_url'].forEach((k) => { patch[k] = String(patch[k] || '').trim() || null; });
    ['slot_step_min', 'min_notice_min', 'max_days_ahead', 'cancel_cutoff_min'].forEach((k) => { patch[k] = Number(patch[k]); });
    const { data, error } = await supabase.from('shops').update(patch).eq('id', shop.id).select().single();
    setBusy(false);
    if (error) return toast(t(errorKey(error)), 'error');
    setShop(data);
    toast(t('common.saved'));
  }

  async function upload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast(t('settings.tooBig'), 'error');
    setUploading(true);
    const path = `${shop.id}/cover-${Date.now()}.${file.name.split('.').pop() || 'jpg'}`;
    const up = await supabase.storage.from('shop-media').upload(path, file, { upsert: true, contentType: file.type });
    if (up.error) { setUploading(false); return toast(t(errorKey(up.error)), 'error'); }
    const { data, error } = await supabase.from('shops').update({ cover_url: path }).eq('id', shop.id).select().single();
    setUploading(false);
    if (error) return toast(t(errorKey(error)), 'error');
    setShop(data);
    toast(t('common.saved'));
  }

  return (
    <form onSubmit={save} className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <Card className="p-5 space-y-4 lg:col-span-2">
        <h3 className="font-bold text-white">{t('settings.info')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label={t('onb.shopName')}><Input required value={f.name} onChange={set('name')} /></Field>
          <Field label={t('onb.area')}><Input value={f.area} onChange={set('area')} placeholder={t('onb.areaPh')} /></Field>
          <Field label={t('settings.address')} className="sm:col-span-2"><Input value={f.address} onChange={set('address')} /></Field>
          <Field label={t('onb.phone')}><Input type="tel" dir="ltr" value={f.phone} onChange={set('phone')} /></Field>
          <Field label="WhatsApp"><Input type="tel" dir="ltr" value={f.whatsapp} onChange={set('whatsapp')} /></Field>
          <Field label={t('settings.specialty')}>
            <Select value={f.specialty || ''} onChange={set('specialty')}>
              <option value="">—</option>
              {SPECIALTIES.map((s) => <option key={s} value={s}>{t(`spec.${s}`)}</option>)}
            </Select>
          </Field>
          <Field label={t('settings.map')} hint={t('settings.mapHint')}><Input dir="ltr" value={f.map_url} onChange={set('map_url')} placeholder="https://maps.app.goo.gl/..." /></Field>
          <Field label={t('settings.description')} className="sm:col-span-2"><Textarea maxLength={600} value={f.description} onChange={set('description')} placeholder={t('settings.descriptionPh')} /></Field>
        </div>

        <h3 className="font-bold text-white pt-2">{t('settings.rules')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label={t('settings.step')} hint={t('settings.stepHint')}>
            <Select value={f.slot_step_min} onChange={set('slot_step_min')}>
              {[10, 15, 20, 30, 60].map((n) => <option key={n} value={n}>{t('common.minutes', { n })}</option>)}
            </Select>
          </Field>
          <Field label={t('settings.notice')} hint={t('settings.noticeHint')}>
            <Select value={f.min_notice_min} onChange={set('min_notice_min')}>
              {[0, 15, 30, 60, 120, 240].map((n) => <option key={n} value={n}>{t('common.minutes', { n })}</option>)}
            </Select>
          </Field>
          <Field label={t('settings.ahead')}>
            <Select value={f.max_days_ahead} onChange={set('max_days_ahead')}>
              {[3, 7, 14, 21, 30, 60].map((n) => <option key={n} value={n}>{t('common.days', { n })}</option>)}
            </Select>
          </Field>
          <Field label={t('settings.cutoff')} hint={t('settings.cutoffHint')}>
            <Select value={f.cancel_cutoff_min} onChange={set('cancel_cutoff_min')}>
              {[0, 30, 60, 120, 180, 360, 720, 1440].map((n) => <option key={n} value={n}>{t('common.minutes', { n })}</option>)}
            </Select>
          </Field>
        </div>
        <div className="flex flex-col gap-3 pt-1">
          <Toggle checked={f.auto_confirm} onChange={(v) => setF({ ...f, auto_confirm: v })} label={t('settings.autoConfirm')} />
          <Toggle checked={f.is_active} onChange={(v) => setF({ ...f, is_active: v })} label={t('settings.visible')} />
        </div>
        <Button type="submit" variant="gold" loading={busy}>{t('common.save')}</Button>
      </Card>

      <Card className="p-5 space-y-3 h-fit">
        <h3 className="font-bold text-white">{t('settings.cover')}</h3>
        <img src={mediaUrl(shop.cover_url) || defaultCover(shop.id)} alt="" className="w-full h-40 object-cover rounded-xl border border-ink-800" />
        <label className="block">
          <span className="sr-only">{t('settings.upload')}</span>
          <input type="file" accept="image/*" onChange={upload} disabled={uploading}
            className="block w-full text-xs text-slate-400 file:me-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-ink-800 file:text-slate-200 file:font-semibold" />
        </label>
        <p className="text-[11px] text-slate-500">{uploading ? t('settings.uploading') : t('settings.coverHint')}</p>
        <div className="pt-2 border-t border-ink-800 text-xs text-slate-400 space-y-1">
          <p>{t('settings.link')}: <span className="text-white ltr">/s/{shop.slug}</span></p>
          <p>{t('settings.plan')}: <span className="text-white">{t(`plans.${shop.plan}`)}</span></p>
        </div>
      </Card>
    </form>
  );
}
