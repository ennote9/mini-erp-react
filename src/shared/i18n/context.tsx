import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useSettings } from "@/shared/settings";
import { createTranslator, type MessageTree, type TFunction } from "./resolve";
import { mergeMessageTree } from "./mergeMessages";
import { localeToHtmlLang, type AppLocaleId } from "./locales";
import { enMessages } from "./messages/en";
import { ruMessages } from "./messages/ru";
import { kkMessages } from "./messages/kk";

type I18nContextValue = {
  locale: AppLocaleId;
  t: TFunction;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const locale = settings.general.locale;

  const value = useMemo((): I18nContextValue => {
    const base = enMessages as MessageTree;
    const override =
      locale === "en" ? {} : locale === "ru" ? (ruMessages as MessageTree) : (kkMessages as MessageTree);
    const primary = locale === "en" ? base : mergeMessageTree(base, override);
    const t = createTranslator(primary, base, locale);
    return { locale, t };
  }, [locale]);

  useEffect(() => {
    document.documentElement.lang = localeToHtmlLang(locale);
  }, [locale]);

  useEffect(() => {
    document.title = value.t("app.name");
  }, [locale, value.t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useTranslation must be used within I18nProvider");
  }
  return ctx;
}

/** Safe for rare use outside provider (e.g. tests): English only. */
export function useTranslationOptional(): I18nContextValue | null {
  return useContext(I18nContext);
}
