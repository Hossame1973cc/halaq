import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export function cx(...a) { return a.filter(Boolean).join(' '); }

const variants = {
  gold: 'gold-gradient text-ink-950 font-bold shadow-lg shadow-amber-500/20 hover:brightness-105',
  dark: 'bg-ink-800 hover:bg-ink-700 text-slate-200 border border-ink-700',
  ghost: 'text-slate-300 hover:text-white hover:bg-ink-800',
  danger: 'bg-rose-500/10 text-rose-300 border border-rose-500/30 hover:bg-rose-500/20',
  success: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20',
  wa: 'bg-[#25D366]/10 text-[#4ade80] border border-[#25D366]/30 hover:bg-[#25D366]/20',
};
const sizes = { sm: 'px-3 py-1.5 text-xs rounded-lg', md: 'px-4 py-2.5 text-sm rounded-xl', lg: 'px-6 py-3 text-base rounded-xl' };

export function Button({ variant = 'dark', size = 'md', className, loading, children, ...props }) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || loading}
      className={cx('inline-flex items-center justify-center gap-2 font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant], sizes[size], className)}
    >
      {loading && <Spinner small />}
      {children}
    </button>
  );
}

export const inputCls = 'w-full bg-ink-950 border border-ink-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition';

export function Field({ label, hint, children, className }) {
  return (
    <label className={cx('block', className)}>
      {label && <span className="block text-xs font-semibold text-slate-400 mb-1.5">{label}</span>}
      {children}
      {hint && <span className="block text-[11px] text-slate-500 mt-1">{hint}</span>}
    </label>
  );
}

export function Input(props) { return <input {...props} className={cx(inputCls, props.className)} />; }
export function Textarea(props) { return <textarea rows={3} {...props} className={cx(inputCls, props.className)} />; }
export function Select({ children, ...props }) { return <select {...props} className={cx(inputCls, props.className)}>{children}</select>; }

export function Card({ className, children, ...p }) {
  return <div {...p} className={cx('card-surface rounded-2xl', className)}>{children}</div>;
}

export function Badge({ tone = 'slate', children, className }) {
  const tones = {
    slate: 'bg-slate-500/10 text-slate-300 border-slate-500/30',
    amber: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    green: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    red: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
    blue: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
    violet: 'bg-violet-500/10 text-violet-300 border-violet-500/30',
  };
  return <span className={cx('inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap', tones[tone], className)}>{children}</span>;
}

export function Spinner({ small }) {
  return <span className={cx('inline-block rounded-full border-2 border-current border-t-transparent animate-spin', small ? 'w-3.5 h-3.5' : 'w-6 h-6')} />;
}

export function Loading() {
  return <div className="flex justify-center py-16 text-amber-400"><Spinner /></div>;
}

export function Empty({ icon = '✂', title, text, action }) {
  return (
    <div className="text-center py-12 px-4">
      <div className="text-4xl mb-3 opacity-70">{icon}</div>
      <p className="font-bold text-white">{title}</p>
      {text && <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 text-sm text-slate-300">
      <span className={cx('relative w-10 h-6 rounded-full transition', checked ? 'bg-amber-500' : 'bg-ink-700')}>
        <span className={cx('absolute top-1 w-4 h-4 rounded-full bg-white transition-all', checked ? 'start-5' : 'start-1')} />
      </span>
      {label}
    </button>
  );
}

export function Modal({ open, onClose, title, subtitle, children, footer, wide }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-ink-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={cx('bg-ink-900 border border-ink-700 w-full sm:rounded-2xl rounded-t-2xl max-h-[94vh] flex flex-col shadow-2xl', wide ? 'sm:max-w-2xl' : 'sm:max-w-md')}>
        <div className="px-5 py-4 border-b border-ink-800 flex items-start justify-between gap-3">
          <div>
            {subtitle && <p className="text-[11px] font-bold uppercase tracking-wider text-amber-400">{subtitle}</p>}
            <h3 className="text-lg font-extrabold text-white">{title}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="close" className="w-8 h-8 shrink-0 rounded-lg bg-ink-800 hover:bg-ink-700 text-slate-300">✕</button>
        </div>
        <div className="p-5 overflow-y-auto custom-scroll flex-1 space-y-4">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-ink-800 bg-ink-950/60 sm:rounded-b-2xl">{footer}</div>}
      </div>
    </div>
  );
}

// ---- Toasts ----
const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((text, type = 'success') => {
    const id = Math.random();
    setItems((x) => [...x, { id, text, type }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:end-4 z-[60] flex flex-col gap-2 sm:w-96 pointer-events-none">
        {items.map((i) => (
          <div key={i.id} className={cx('px-4 py-3 rounded-xl text-sm font-semibold shadow-2xl border backdrop-blur-md',
            i.type === 'error' ? 'bg-rose-950/90 border-rose-500/40 text-rose-100' : 'bg-ink-850/95 border-amber-500/40 text-white')}>
            {i.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

export function Stars({ value = 0, size = 'text-sm' }) {
  const v = Math.round(Number(value));
  return <span className={cx('text-amber-400 tracking-tight', size)} aria-label={`${value}/5`}>{'★'.repeat(v)}<span className="text-ink-700">{'★'.repeat(5 - v)}</span></span>;
}
