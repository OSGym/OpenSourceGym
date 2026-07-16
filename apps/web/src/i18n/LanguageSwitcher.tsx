import { useTranslation } from "react-i18next";
import { setLanguage } from "./index";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { t, i18n } = useTranslation();
  const active = i18n.resolvedLanguage?.startsWith("tr") ? "tr" : "en";

  return (
    <div className={`language-switcher${compact ? " compact" : ""}`}>
      <button
        type="button"
        className={active === "tr" ? "active" : ""}
        aria-label={t("Dili Türkçe yap")}
        aria-pressed={active === "tr"}
        onClick={() => void setLanguage("tr")}
      >
        TR
      </button>
      <span aria-hidden="true">/</span>
      <button
        type="button"
        className={active === "en" ? "active" : ""}
        aria-label={t("Dili İngilizce yap")}
        aria-pressed={active === "en"}
        onClick={() => void setLanguage("en")}
      >
        EN
      </button>
    </div>
  );
}
