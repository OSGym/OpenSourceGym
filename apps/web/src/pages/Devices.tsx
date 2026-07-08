import { useEffect, useState } from "react";
import type { Device, DeviceCreated, DeviceDirection } from "@opengym/shared";
import { api } from "../lib/api";

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("tr-TR") : "—";

const directionLabels: Record<DeviceDirection, string> = {
  in: "Giriş",
  out: "Çıkış",
};

export function Devices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [direction, setDirection] = useState<DeviceDirection>("in");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<DeviceCreated | null>(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    try {
      setDevices(await api<Device[]>("/api/admin/devices"));
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

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const device = await api<DeviceCreated>("/api/admin/devices", {
        method: "POST",
        body: { name, direction },
      });
      setCreated(device);
      setName("");
      setDirection("in");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cihaz eklenemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(device: Device) {
    if (!confirm(`"${device.name}" cihazını silmek istediğinize emin misiniz?`)) {
      return;
    }
    setError(null);
    try {
      await api(`/api/admin/devices/${device.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cihaz silinemedi.");
    }
  }

  async function copyToken() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.token);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="stagger">
      <h1>Cihazlar</h1>
      {error && <div className="msg error">{error}</div>}
      {created && (
        <div className="panel">
          <h2>Yeni cihaz — {created.name}</h2>
          <p style={{ color: "var(--ink-dim)", marginBottom: 10 }}>
            Bu token yalnızca şimdi görüntülenir; cihazın yapılandırmasına
            kaydedin. Kaybederseniz cihazı silip yeniden eklemeniz gerekir.
          </p>
          <div className="row" style={{ alignItems: "center" }}>
            <code className="mono" style={{ wordBreak: "break-all" }}>
              {created.token}
            </code>
            <button type="button" className="ghost" onClick={() => void copyToken()}>
              {copied ? "Kopyalandı" : "Kopyala"}
            </button>
          </div>
        </div>
      )}
      <div className="panel">
        <h2>Cihaz ekle</h2>
        <form className="row" onSubmit={create}>
          <div className="field">
            <label htmlFor="deviceName">Ad</label>
            <input
              id="deviceName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Giriş turnikesi"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="deviceDirection">Yön</label>
            <select
              id="deviceDirection"
              value={direction}
              onChange={(e) => setDirection(e.target.value as DeviceDirection)}
            >
              <option value="in">Giriş</option>
              <option value="out">Çıkış</option>
            </select>
          </div>
          <button type="submit" disabled={busy}>
            {busy ? "Ekleniyor…" : "Cihaz ekle"}
          </button>
        </form>
      </div>
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>Ad</th>
              <th>Yön</th>
              <th>Durum</th>
              <th>Son görülme</th>
              <th>Eklenme</th>
              <th>Uptime (24s)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {devices.map((d) => (
              <tr key={d.id}>
                <td>{d.name}</td>
                <td>{directionLabels[d.direction]}</td>
                <td>
                  {d.online ? (
                    <span className="badge ok">Çevrimiçi</span>
                  ) : (
                    <span className="badge danger">Çevrimdışı</span>
                  )}
                </td>
                <td>{fmt(d.lastSeenAt)}</td>
                <td>{fmt(d.createdAt)}</td>
                <td>{d.uptime24h.toFixed(1)}%</td>
                <td>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => void remove(d)}
                  >
                    Sil
                  </button>
                </td>
              </tr>
            ))}
            {devices.length === 0 && !error && (
              <tr>
                <td colSpan={7}>Kayıtlı cihaz yok.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
