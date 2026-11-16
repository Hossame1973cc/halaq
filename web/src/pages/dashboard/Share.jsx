import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { SITE_URL } from '../../lib/supabase';
import { useI18n } from '../../lib/i18n';
import { waLink } from '../../lib/format';
import { Button, Card, useToast } from '../../components/ui';
import { useDash } from './DashboardLayout';

export default function Share() {
  const { shop, barbers, services } = useDash();
  const { t, lang } = useI18n();
  const toast = useToast();
  const url = `${SITE_URL}/s/${shop.slug}`;
  const [qr, setQr] = useState('');

  useEffect(() => {
    QRCode.toDataURL(url, { width: 640, margin: 1, color: { dark: '#090D16', light: '#FFFFFF' }, errorCorrectionLevel: 'M' }).then(setQr);
  }, [url]);

  const ready = barbers.some((b) => b.is_active) && services.some((s) => s.is_active);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="space-y-5 no-print">
        {!ready && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">⚠️ {t('share.notReady')}</div>
        )}
        <Card className="p-5 space-y-3">
          <h3 className="font-bold text-white">{t('share.linkTitle')}</h3>
          <p className="text-xs text-slate-400">{t('share.linkSub')}</p>
          <div className="flex gap-2" dir="ltr">
            <input readOnly value={url} className="flex-1 bg-ink-950 border border-ink-700 rounded-xl px-3 py-2.5 text-sm text-amber-300" onFocus={(e) => e.target.select()} />
            <Button onClick={() => { navigator.clipboard?.writeText(url); toast(t('common.copied')); }}>{t('share.copy')}</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={waLink('', t('share.waText', { shop: shop.name, url }))} target="_blank" rel="noreferrer"><Button size="sm" variant="wa">{t('share.viaWa')}</Button></a>
            <a href={url} target="_blank" rel="noreferrer"><Button size="sm">{t('dash.viewPage')} ↗</Button></a>
          </div>
        </Card>
        <Card className="p-5 space-y-2 text-sm text-slate-300">
          <h3 className="font-bold text-white">{t('share.tipsTitle')}</h3>
          <ul className="space-y-1.5 list-disc ps-5">
            <li>{t('share.tip1')}</li>
            <li>{t('share.tip2')}</li>
            <li>{t('share.tip3')}</li>
          </ul>
        </Card>
      </div>

      <Card className="p-5 space-y-4 print:bg-transparent print:border-0">
        <div className="flex items-center justify-between no-print">
          <h3 className="font-bold text-white">{t('share.qrTitle')}</h3>
          <div className="flex gap-2">
            {qr && <a href={qr} download={`halaq-${shop.slug}-qr.png`}><Button size="sm">⬇ PNG</Button></a>}
            <Button size="sm" variant="gold" onClick={() => window.print()}>🖨 {t('share.print')}</Button>
          </div>
        </div>
        {/* Printable poster */}
        <div className="bg-white text-ink-950 rounded-2xl p-6 sm:p-8 text-center space-y-3 max-w-sm mx-auto" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          <p className="text-sm font-bold tracking-wide text-amber-600">✂ {t('app.name')}</p>
          <h2 className="text-2xl font-extrabold">{shop.name}</h2>
          <p className="text-lg font-extrabold">{t('share.posterTitle')}</p>
          {qr && <img src={qr} alt="QR" className="w-56 h-56 mx-auto" />}
          <p className="text-sm text-slate-600">{t('share.posterSub')}</p>
          <p className="text-xs text-slate-500 ltr">{url.replace(/^https?:\/\//, '')}</p>
        </div>
      </Card>
    </div>
  );
}
