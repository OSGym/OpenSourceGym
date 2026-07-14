import { localeFor } from "./core";

export function dateLocale(resolvedLanguage: string | undefined): string {
  return localeFor(resolvedLanguage);
}
