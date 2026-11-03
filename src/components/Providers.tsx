"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { DICTIONARIES, fill, type Dictionary, type Locale } from "@/i18n/dictionary";
import { PREF_LOCALE, PREF_THEME, usePref } from "@/lib/prefs";

type Theme = "light" | "dark" | "system";

interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Dictionary;
  /** Translate + interpolate in one call: tr(t.issue.neighborsAffected, {n: 12}) */
  tr: (template: string, vars?: Record<string, string | number>) => string;
}

interface ThemeValue {
  theme: Theme;
  resolved: "light" | "dark";
  setTheme: (theme: Theme) => void;
}

const I18nContext = createContext<I18nValue | null>(null);
const ThemeContext = createContext<ThemeValue | null>(null);

function usePrefersDark(): boolean {
  const subscribe = useCallback((cb: () => void) => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    mql.addEventListener("change", cb);
    return () => mql.removeEventListener("change", cb);
  }, []);

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
    () => false,
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const [locale, setLocale] = usePref<Locale>(PREF_LOCALE, "en");
  const [theme, setTheme] = usePref<Theme>(PREF_THEME, "system");
  const prefersDark = usePrefersDark();

  const isDark = theme === "dark" || (theme === "system" && prefersDark);

  const i18n = useMemo<I18nValue>(() => {
    const t = DICTIONARIES[locale] ?? DICTIONARIES.en;
    return {
      locale,
      setLocale: (next: Locale) => setLocale(next),
      t,
      tr: (template, vars) => (vars ? fill(template, vars) : template),
    };
  }, [locale, setLocale]);

  const themeValue = useMemo<ThemeValue>(
    () => ({ theme, resolved: isDark ? "dark" : "light", setTheme }),
    [theme, isDark, setTheme],
  );

  useEffect(() => {
    document.documentElement.lang = locale === "fil" ? "fil" : "en";
  }, [locale]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", isDark);
    root.style.colorScheme = isDark ? "dark" : "light";
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", isDark ? "#0b0f14" : "#f7f5f0");
  }, [isDark]);

  return (
    <ThemeContext.Provider value={themeValue}>
      <I18nContext.Provider value={i18n}>{children}</I18nContext.Provider>
    </ThemeContext.Provider>
  );
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <Providers>");
  return ctx;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <Providers>");
  return ctx;
}
