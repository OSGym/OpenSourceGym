import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import {
  isLanguage,
  LANGUAGE_STORAGE_KEY,
  resolveLanguage,
  type Language,
} from "./core";
import { resources } from "./resources";

function storedLanguage(): string | null {
  try {
    return window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function preferredLanguages(): readonly string[] {
  return navigator.languages.length > 0
    ? navigator.languages
    : [navigator.language];
}

function updateDocumentLanguage(language: string) {
  document.documentElement.lang = language;
}

const initialLanguage = resolveLanguage(storedLanguage(), preferredLanguages());

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: "en",
  supportedLngs: ["tr", "en"],
  keySeparator: false,
  nsSeparator: false,
  interpolation: { escapeValue: false },
  initAsync: false,
});

updateDocumentLanguage(initialLanguage);

export async function setLanguage(language: Language): Promise<void> {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Storage may be unavailable in hardened/private browser contexts.
  }
  await i18n.changeLanguage(language);
  updateDocumentLanguage(language);
}

window.addEventListener("languagechange", () => {
  if (isLanguage(storedLanguage())) return;
  const language = resolveLanguage(null, preferredLanguages());
  void i18n
    .changeLanguage(language)
    .then(() => updateDocumentLanguage(language));
});

export { i18n };
