import { useEffect, useState } from "react";
import type {
  EntryDenyReason,
  EntryEvent,
  OccupancyResponse,
} from "@opengym/shared";
import { api } from "../lib/api";

const reasonLabels: Record<EntryDenyReason, string> = {
  INVALID_TOKEN: "Geçersiz kod",
  EXPIRED: "Süresi dolmuş kod",
  REPLAY: "Tekrar kullanılmış kod",
  NO_ACTIVE_SUBSCRIPTION: "Aktif abonelik yok",
};

const reasonLabel = (reason: EntryDenyReason | null) =>
  reason ? reasonLabels[reason] : "—";

export function Entries() {
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
      setError(err instanceof Error ? err.message : "Yüklenemedi.");
    }
  }

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 10000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="stagger">
      <h1>Geçişler</h1>
      {occupancy && (
        <p className="hint" style={{ marginBottom: 16 }}>
          İçeride: {occupancy.inside}
          {occupancy.ratio != null &&
            ` · %${Math.round(occupancy.ratio * 100)} doluluk`}
        </p>
      )}
      {error && <div className="msg error">{error}</div>}
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>Zaman</th>
              <th>Cihaz</th>
              <th>Üye</th>
              <th>Sonuç</th>
              <th>Neden</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td>{new Date(e.at).toLocaleString("tr-TR")}</td>
                <td>{e.deviceName}</td>
                <td>{e.memberName ?? "—"}</td>
                <td>
                  {e.allowed ? (
                    <span className="badge ok">İzin verildi</span>
                  ) : (
                    <span className="badge danger">Reddedildi</span>
                  )}
                </td>
                <td>{reasonLabel(e.reason)}</td>
              </tr>
            ))}
            {entries.length === 0 && !error && (
              <tr>
                <td colSpan={5}>Kayıt yok.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
