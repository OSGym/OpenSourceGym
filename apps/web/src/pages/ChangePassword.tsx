import { useState } from "react";
import { api } from "../lib/api";
import { AuthLayout } from "../components/AuthLayout";

export function ChangePassword({ onDone }: { onDone: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      setError("Yeni şifreler eşleşmiyor.");
      return;
    }
    if (next.length < 8) {
      setError("Yeni şifre en az 8 karakter olmalı.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api("/api/admin/initial-password", {
        method: "POST",
        body: { currentPassword: current, newPassword: next },
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "İşlem başarısız.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <form onSubmit={submit}>
        <h1>Şifre değiştir</h1>
        <p className="sub">
          Güvenlik gereği devam etmeden önce varsayılan şifrenizi
          değiştirmelisiniz.
        </p>
        {error && <div className="msg error">{error}</div>}
        <div className="field">
          <label htmlFor="current">Mevcut şifre</label>
          <input
            id="current"
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="next">Yeni şifre</label>
          <input
            id="next"
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="confirm">Yeni şifre (tekrar)</label>
          <input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>
        <button type="submit" disabled={busy} style={{ width: "100%" }}>
          {busy ? "Kaydediliyor…" : "Şifreyi değiştir"}
        </button>
      </form>
    </AuthLayout>
  );
}
