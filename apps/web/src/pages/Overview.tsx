import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  AdminStats,
  EntryEvent,
  OccupancyResponse,
  PublicUser,
} from "@opengym/shared";
import { api } from "../lib/api";
import { errorMessage } from "../i18n/errors";
import { dateLocale } from "../i18n/format";

// Ödeme/gelir takibi kapsam dışı (PRD non-goal) — kart yalnızca görsel
// tutarlılık için placeholder değerle blurlu gösterilir.
const MOCK_REVENUE = 4280;

function KpiCard({
  label,
  value,
  delta,
  color,
  blurred,
}: {
  label: string;
  value: string;
  delta?: string;
  color?: string;
  blurred?: boolean;
}) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div
        className={blurred ? "kpi-value kpi-blur" : "kpi-value"}
        style={color ? { color } : undefined}
      >
        {value}
      </div>
      {delta && <div className="kpi-delta">{delta}</div>}
    </div>
  );
}

export function Overview() {
  const { t, i18n } = useTranslation();
  const locale = dateLocale(i18n.resolvedLanguage);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [occupancy, setOccupancy] = useState<OccupancyResponse | null>(null);
  const [entries, setEntries] = useState<EntryEvent[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [s, occ, ev] = await Promise.all([
        api<AdminStats>("/api/admin/stats"),
        api<OccupancyResponse>("/api/me/occupancy"),
        api<EntryEvent[]>("/api/admin/entry-events"),
      ]);
      setStats(s);
      setOccupancy(occ);
      setEntries(ev.slice(0, 6));
      setError(null);
    } catch (err) {
      setError(errorMessage(err, t, "Yüklenemedi."));
    }
  }

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => clearInterval(timer);
  }, []);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      return;
    }
    try {
      setResults(
        await api<PublicUser[]>(`/api/admin/users?q=${encodeURIComponent(q)}`),
      );
    } catch (err) {
      setResults(null);
      setError(errorMessage(err, t, "Arama başarısız."));
    }
  }

  const occupancyValue =
    occupancy?.ratio != null
      ? `%${Math.round(occupancy.ratio * 100)}`
      : (occupancy?.inside.toString() ?? "—");
  const occupancyDelta =
    occupancy == null
      ? undefined
      : occupancy.capacity != null
        ? t("{{inside}}/{{capacity}} kişi içeride", {
            inside: occupancy.inside,
            capacity: occupancy.capacity,
          })
        : t("{{inside}} kişi içeride", { inside: occupancy.inside });

  return (
    <div className="stagger">
      <h1>{t("Genel Bakış")}</h1>
      {error && <div className="msg error">{error}</div>}

      <div className="kpi-grid">
        <KpiCard
          label={t("Bugünkü Gelir")}
          value={new Intl.NumberFormat(locale, {
            style: "currency",
            currency: "TRY",
            maximumFractionDigits: 0,
          }).format(MOCK_REVENUE)}
          delta={t("Ödeme takibi yakında")}
          color="var(--ok)"
          blurred
        />
        <KpiCard
          label={t("Aktif Üye")}
          value={stats ? String(stats.activeMembers) : "—"}
          delta={t("aktif abonelik")}
        />
        <KpiCard
          label={t("Salon Doluluk Oranı")}
          value={occupancyValue}
          delta={occupancyDelta}
        />
        <KpiCard
          label={t("Yenileme Bekleyen")}
          value={stats ? String(stats.renewalsDue) : "—"}
          delta={t("7 gün içinde")}
          color="var(--warn)"
        />
      </div>

      <div className="overview-grid">
        <div className="panel">
          <div
            className="row"
            style={{ justifyContent: "space-between", marginBottom: 18 }}
          >
            <h2 style={{ marginBottom: 0 }}>{t("Üyeler")}</h2>
            <form onSubmit={search}>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("Üye ara…")}
                style={{ width: 220 }}
              />
            </form>
          </div>
          <table>
            <thead>
              <tr>
                <th>{t("Ad Soyad")}</th>
                <th>{t("Telefon")}</th>
                <th>{t("E-posta")}</th>
                <th>{t("Rol")}</th>
              </tr>
            </thead>
            <tbody>
              {(results ?? []).map((u) => (
                <tr key={u.id}>
                  <td>
                    {u.firstName} {u.lastName}
                  </td>
                  <td>{u.phone}</td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`badge ${u.role}`}>
                      {t(
                        u.role === "admin"
                          ? "Yönetici"
                          : u.role === "staff"
                            ? "Personel"
                            : "Üye",
                      )}
                    </span>
                  </td>
                </tr>
              ))}
              {results !== null && results.length === 0 && (
                <tr>
                  <td colSpan={4}>{t("Eşleşen üye bulunamadı.")}</td>
                </tr>
              )}
              {results === null && (
                <tr>
                  <td colSpan={4}>
                    {t("Aramak için en az iki karakter girin.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <h2>{t("Son Geçişler")}</h2>
          <div className="list">
            {entries.map((e) => (
              <div className="list-row" key={e.id}>
                <div className="list-row-main">
                  <div className="list-row-title">
                    {e.memberName ?? e.deviceName}
                  </div>
                  <div className="list-row-sub">{e.deviceName}</div>
                </div>
                <div className="list-row-side">
                  <div>
                    {new Date(e.at).toLocaleTimeString(locale, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                  <div
                    className={e.allowed ? "list-row-ok" : "list-row-danger"}
                  >
                    {e.allowed ? t("İzin verildi") : t("Reddedildi")}
                  </div>
                </div>
              </div>
            ))}
            {entries.length === 0 && <p className="hint">{t("Kayıt yok.")}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
