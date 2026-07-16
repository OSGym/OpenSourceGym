import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AuditLogEntry } from "@opengym/shared";
import { api } from "../lib/api";
import { errorMessage } from "../i18n/errors";
import { dateLocale } from "../i18n/format";
import type { WebTranslationKey } from "../i18n/resources";

const actionLabels: Partial<Record<string, WebTranslationKey>> = {
  "sharing-signal": "Paylaşım sinyali",
  "account-sharing-blocked": "Hesap paylaşımı engellendi",
  "profile-photo-updated": "Profil fotoğrafı güncellendi",
  "profile-photo-removed": "Profil fotoğrafı kaldırıldı",
  "kvkk-deletion-requested": "Silme talebi oluşturuldu",
  "kvkk-deletion-cancelled": "Silme talebi iptal edildi",
  "device-created": "Cihaz oluşturuldu",
  "device-deleted": "Cihaz silindi",
  "initial-password-changed": "İlk şifre değiştirildi",
  "role-assigned": "Rol atandı",
  "subscription-created": "Abonelik oluşturuldu",
  "settings-updated": "Ayarlar güncellendi",
  "kvkk-deletion-approved": "Silme talebi onaylandı",
  "kvkk-deletion-rejected": "Silme talebi reddedildi",
};

export function Audit() {
  const { t, i18n } = useTranslation();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<AuditLogEntry[]>("/api/admin/audit")
      .then(setEntries)
      .catch((err) => setError(errorMessage(err, t, "Yüklenemedi.")));
  }, []);

  return (
    <div className="stagger">
      <h1>{t("İşlem kaydı")}</h1>
      {error && <div className="msg error">{error}</div>}
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>{t("Zaman")}</th>
              <th>{t("Kim")}</th>
              <th>{t("İşlem")}</th>
              <th>{t("Detay")}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => {
              const actionLabel = actionLabels[e.action];
              return (
                <tr key={e.id}>
                  <td>
                    {new Date(e.at).toLocaleString(
                      dateLocale(i18n.resolvedLanguage),
                    )}
                  </td>
                  <td>{e.actorEmail}</td>
                  <td>{actionLabel ? t(actionLabel) : e.action}</td>
                  <td>{e.details ? JSON.stringify(e.details) : "—"}</td>
                </tr>
              );
            })}
            {entries.length === 0 && !error && (
              <tr>
                <td colSpan={4}>{t("Kayıt yok.")}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
