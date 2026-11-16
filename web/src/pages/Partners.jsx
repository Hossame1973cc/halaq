import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { money } from '../lib/format';
import { Button, Card } from '../components/ui';

function Range({ label, value, display, ...p }) {
  return (
    <label className="block">
      <span className="flex justify-between text-xs mb-1"><span className="text-slate-300">{label}</span><b className="text-amber-400">{display ?? value}</b></span>
      <input type="range" value={value} {...p} className="w-full accent-amber-500 cursor-pointer" />
    </label>
  );
}

export default function Partners() {
  const { t, lang } = useI18n();
  const { user, memberships } = useAuth();
  const [chairs, setChairs] = useState(3);
  const [ticket, setTicket] = useState(150);
  const [saved, setSaved] = useState(3);
  const [fee, setFee] = useState(299);

  const monthlyGain = chairs * ticket * saved * 4.3;
  const breakEven = fee / ticket;
  const annualNet = (monthlyGain - fee) * 12;
  const cta = memberships.length ? '/dashboard' : user ? '/start' : '/signup?next=/start';

  const features = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6'];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-10">
      <section className="text-center max-w-3xl mx-auto space-y-4">
        <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">💈 {t('partners.kicker')}</span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight">{t('partners.title')}</h1>
        <p className="text-slate-300">{t('partners.sub')}</p>
        <Link to={cta}><Button variant="gold" size="lg">{t('partners.cta')}</Button></Link>
        <p className="text-xs text-slate-500">{t('partners.ctaNote')}</p>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map((k, i) => (
          <Card key={k} className="p-5">
            <div className="text-2xl mb-2">{['📅', '🚫', '📲', '💈', '📊', '🔳'][i]}</div>
            <h3 className="font-bold text-white">{t(`partners.${k}`)}</h3>
            <p className="text-sm text-slate-400 mt-1">{t(`partners.${k}d`)}</p>
          </Card>
        ))}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <Card className="p-6 space-y-5">
          <div>
            <h2 className="text-lg font-extrabold text-white">{t('roi.title')}</h2>
            <p className="text-xs text-slate-400">{t('roi.sub')}</p>
          </div>
          <Range label={t('roi.chairs')} min={1} max={12} value={chairs} onChange={(e) => setChairs(+e.target.value)} />
          <Range label={t('roi.ticket')} min={50} max={600} step={10} value={ticket} display={money(ticket, lang)} onChange={(e) => setTicket(+e.target.value)} />
          <Range label={t('roi.saved')} min={1} max={10} value={saved} onChange={(e) => setSaved(+e.target.value)} />
          <Range label={t('roi.fee')} min={99} max={799} step={50} value={fee} display={money(fee, lang)} onChange={(e) => setFee(+e.target.value)} />
          <div className="grid grid-cols-3 gap-3">
            {[[t('roi.gain'), money(monthlyGain, lang), 'text-emerald-400'],
              [t('roi.breakeven'), t('roi.cuts', { n: breakEven.toFixed(1) }), 'text-amber-400'],
              [t('roi.annual'), money(annualNet, lang), 'text-white']].map(([l, v, c]) => (
              <div key={l} className="bg-ink-950 border border-ink-800 rounded-xl p-3 text-center">
                <span className="text-[11px] text-slate-400 block">{l}</span>
                <span className={`text-base sm:text-lg font-extrabold ${c}`}>{v}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-500">{t('roi.note')}</p>
        </Card>

        <div className="space-y-4">
          <h2 className="text-lg font-extrabold text-white">{t('plans.title')}</h2>
          {[['starter', 199, ['p1', 'p2', 'p3', 'p4']], ['pro', 399, ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']]].map(([k, price, items]) => (
            <Card key={k} className={`p-5 ${k === 'pro' ? 'border-amber-500/40' : ''}`}>
              <div className="flex items-baseline justify-between">
                <h3 className="font-extrabold text-white text-lg">{t(`plans.${k}`)}</h3>
                <span className="text-amber-400 font-extrabold text-xl">{money(price, lang)}<span className="text-xs text-slate-400 font-normal"> / {t('plans.month')}</span></span>
              </div>
              <p className="text-xs text-slate-400 mt-1">{t(`plans.${k}Desc`)}</p>
              <ul className="mt-3 space-y-1.5 text-sm text-slate-300">
                {items.map((i) => <li key={i}>✓ {t(`plans.${k}.${i}`)}</li>)}
              </ul>
            </Card>
          ))}
          <p className="text-xs text-slate-500">{t('plans.trialNote')}</p>
        </div>
      </section>
    </div>
  );
}
