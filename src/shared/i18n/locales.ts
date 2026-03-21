export type AppLocaleId = "en" | "ru" | "kk";

export const APP_LOCALE_IDS: readonly AppLocaleId[] = ["en", "ru", "kk"];

export const DEFAULT_APP_LOCALE: AppLocaleId = "en";

export function isAppLocaleId(v: unknown): v is AppLocaleId {
  return v === "en" || v === "ru" || v === "kk";
}

export function normalizeAppLocale(v: unknown): AppLocaleId {
  return isAppLocaleId(v) ? v : DEFAULT_APP_LOCALE;
}

/** BCP 47 lang for <html lang> */
export function localeToHtmlLang(locale: AppLocaleId): string {
  return locale === "kk" ? "kk" : locale;
}
