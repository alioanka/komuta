'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { catalog, type Locale } from '@komuta/shared';

const LOCALE_KEY = 'komuta_locale';

type Catalog = (typeof catalog)['tr'];

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: Catalog;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('tr');

  useEffect(() => {
    const stored = window.localStorage.getItem(LOCALE_KEY) as Locale | null;
    if (stored === 'tr' || stored === 'en') setLocaleState(stored);
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    window.localStorage.setItem(LOCALE_KEY, l);
    document.documentElement.lang = l;
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, t: catalog[locale] }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
