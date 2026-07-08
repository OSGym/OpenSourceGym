import { useEffect, useState } from "react";
import type { AuditLogEntry } from "@opengym/shared";
import { api } from "../lib/api";

export function Audit() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<AuditLogEntry[]>("/api/admin/audit")
      .then(setEntries)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Yüklenemedi."),
      );
  }, []);

  return (
    <div className="stagger">
      <h1>İşlem kaydı</h1>
      {error && <div className="msg error">{error}</div>}
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>Zaman</th>
              <th>Kim</th>
              <th>İşlem</th>
              <th>Detay</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td>{new Date(e.at).toLocaleString("tr-TR")}</td>
                <td>{e.actorEmail}</td>
                <td>{e.action}</td>
                <td>{e.details ? JSON.stringify(e.details) : "—"}</td>
              </tr>
            ))}
            {entries.length === 0 && !error && (
              <tr>
                <td colSpan={4}>Kayıt yok.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
