import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { dict } from './dict';

const I18nCtx = createContext(null);

function initialLang() {
  try {
    const saved = localStorage.getItem('halaq.lang');
    if (saved === 'ar' || saved === 'en') return saved;
  } catch { /* ignore */ }
  return 'ar';
}

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    try { localStorage.setItem('halaq.lang', lang); } catch { /* ignore */ }
  }, [lang]);

  const value = useMemo(() => {
    const t = (key, vars) => {
      let s = dict[lang]?.[key] ?? dict.en[key] ?? key;
      if (vars) Object.entries(vars).forEach(([k, v]) => { s = s.replaceAll(`{${k}}`, v); });
      return s;
    };
    return { lang, setLang, t, dir: lang === 'ar' ? 'rtl' : 'ltr', toggle: () => setLang(lang === 'ar' ? 'en' : 'ar') };
  }, [lang]);

  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export const useI18n = () => useContext(I18nCtx);
