import { useEffect, useState } from "react";
import type { DeletionRequest } from "@opengym/shared";
import { api } from "../lib/api";

const fmt = (iso: string) => new Date(iso).toLocaleDateString("tr-TR");

const statusMeta: Record<
  DeletionRequest["status"],
  { cls: string; label: string }
> = {
  pending: { cls: "warn", label: "Bekliyor" },
  approved: { cls: "ok", label: "Onaylandı" },
  rejected: { cls: "danger", label: "Reddedildi" },
};

export function Kvkk() {
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    try {
      setRequests(await api<DeletionRequest[]>("/api/admin/deletion-requests"));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yüklenemedi.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function approve(r: DeletionRequest) {
    const who = r.name || r.email || "Bu üyenin";
    if (
      !confirm(
        `${who} hesabı ve tüm ilişkili verileri kalıcı olarak silinecek. Bu işlem geri alınamaz. Onaylıyor musunuz?`,
      )
    ) {
      return;
    }
    setBusyId(r.id);
    setError(null);
    try {
      await api(`/api/admin/deletion-requests/${r.id}/approve`, {
        method: "POST",
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "İşlem başarısız.");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(r: DeletionRequest) {
    setBusyId(r.id);
    setError(null);
    try {
      await api(`/api/admin/deletion-requests/${r.id}/reject`, {
        method: "POST",
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "İşlem başarısız.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="stagger">
      <h1>KVKK silme talepleri</h1>
      {error && <div className="msg error">{error}</div>}
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>Üye</th>
              <th>E-posta</th>
              <th>Talep tarihi</th>
              <th>Durum</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id}>
                <td>{r.name || "—"}</td>
                <td>{r.email || "—"}</td>
                <td>{fmt(r.requestedAt)}</td>
                <td>
                  <span className={`badge ${statusMeta[r.status].cls}`}>
                    {statusMeta[r.status].label}
                  </span>
                </td>
                <td>
                  {r.status === "pending" && (
                    <div className="row">
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => void approve(r)}
                      >
                        Onayla
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        disabled={busyId === r.id}
                        onClick={() => void reject(r)}
                      >
                        Reddet
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {requests.length === 0 && !error && (
              <tr>
                <td colSpan={5}>Talep yok.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
