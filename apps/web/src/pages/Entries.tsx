import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  EntryEvent,
  GateRejectCode,
  OccupancyResponse,
} from "@opengym/shared";
import { api } from "../lib/api";
import { errorMessage } from "../i18n/errors";
import { dateLocale } from "../i18n/format";
import type { WebTranslationKey } from "../i18n/resources";

const reasonLabels: Record<GateRejectCode, WebTranslationKey> = {
  INVALID_QR: "Geçersiz kod",
  UNKNOWN_DEVICE: "Bilinmeyen cihaz",
  DEVICE_OFFLINE: "Turnike çevrimdışı",
  NO_ACTIVE_SUBSCRIPTION: "Aktif abonelik yok",
  LOCATION_REQUIRED: "Konum alınamadı",
  OUT_OF_RANGE: "Salon dışı konum",
  MOCK_LOCATION: "Sahte konum",
  SHARING_BLOCKED: "Paylaşım engeli",
};

// Eski akıştan (INVALID_TOKEN/EXPIRED/REPLAY) kalan kayıtlar için ham metne düşer
export function Entries() {
  const { t, i18n } = useTranslation();
  const locale = dateLocale(i18n.resolvedLanguage);
  const reasonLabel = (reason: string | null) => {
    if (!reason) return "—";
    const key = (reasonLabels as Partial<Record<string, WebTranslationKey>>)[
      reason
    ];
    return key ? t(key) : reason;
  };
  const [entries, setEntries] = useState<EntryEvent[]>([]);
  const [occupancy, setOccupancy] = useState<OccupancyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [events, occ] = await Promise.all([
        api<EntryEvent[]>("/api/admin/entry-events"),
        api<OccupancyResponse>("/api/me/occupancy"),
      ]);
      setEntries(events);
      setOccupancy(occ);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, t, "Yüklenemedi."));
    }
  }

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 10000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="stagger">
      <h1>{t("Geçişler")}</h1>
      {occupancy && (
        <p className="hint" style={{ marginBottom: 16 }}>
          {t("İçeride: {{count}}", { count: occupancy.inside })}
          {occupancy.ratio != null &&
            ` · ${t("Doluluk: %{{percent}}", {
              percent: Math.round(occupancy.ratio * 100),
            })}`}
        </p>
      )}
      {error && <div className="msg error">{error}</div>}
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>{t("Zaman")}</th>
              <th>{t("Cihaz")}</th>
              <th>{t("Üye")}</th>
              <th>{t("Sonuç")}</th>
              <th>{t("Neden")}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td>{new Date(e.at).toLocaleString(locale)}</td>
                <td>{e.deviceName}</td>
                <td>{e.memberName ?? "—"}</td>
                <td>
                  {e.allowed ? (
                    <span className="badge ok">{t("İzin verildi")}</span>
                  ) : (
                    <span className="badge danger">{t("Reddedildi")}</span>
                  )}
                </td>
                <td>{reasonLabel(e.reason)}</td>
              </tr>
            ))}
            {entries.length === 0 && !error && (
              <tr>
                <td colSpan={5}>{t("Kayıt yok.")}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
