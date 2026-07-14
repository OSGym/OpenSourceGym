export const LANGUAGE_STORAGE_KEY = "opengym.language";

export type Language = "tr" | "en";

export function isLanguage(value: unknown): value is Language {
  return value === "tr" || value === "en";
}

export function resolveLanguage(
  stored: string | null | undefined,
  preferredLanguages: readonly string[],
): Language {
  if (isLanguage(stored)) return stored;

  for (const tag of preferredLanguages) {
    const language = tag.trim().toLowerCase().split(/[-_]/, 1)[0];
    if (isLanguage(language)) return language;
  }

  return "en";
}

export function localeFor(language: string | undefined): "tr-TR" | "en-US" {
  return language?.toLowerCase().startsWith("tr") ? "tr-TR" : "en-US";
}
