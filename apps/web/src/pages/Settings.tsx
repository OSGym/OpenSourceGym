import { useEffect, useState } from "react";
import type { GymSettings } from "@opengym/shared";
import { api } from "../lib/api";

export function Settings() {
  const [gymName, setGymName] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [radiusM, setRadiusM] = useState("");
  const [capacity, setCapacity] = useState("");
  const [autoExitHours, setAutoExitHours] = useState("");
  const [msg, setMsg] = useState<{ kind: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api<GymSettings>("/api/admin/settings").then((s) => {
      setGymName(s.gymName);
      if (s.location) {
        setLat(String(s.location.lat));
        setLng(String(s.location.lng));
        setRadiusM(String(s.location.radiusM));
      }
      if (s.capacity != null) setCapacity(String(s.capacity));
      setAutoExitHours(String(s.autoExitHours));
    });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api("/api/admin/settings", {
        method: "PUT",
        body: {
          gymName,
          location:
            lat && lng && radiusM
              ? { lat: Number(lat), lng: Number(lng), radiusM: Number(radiusM) }
              : null,
          capacity: capacity ? Number(capacity) : null,
          autoExitHours: Number(autoExitHours),
        },
      });
      setMsg({ kind: "success", text: "Ayarlar kaydedildi." });
    } catch (err) {
      setMsg({
        kind: "error",
        text: err instanceof Error ? err.message : "Kaydedilemedi.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stagger">
      <h1>Salon ayarları</h1>
      <form className="panel" onSubmit={save} style={{ maxWidth: 560 }}>
        {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}
        <div className="field">
          <label htmlFor="gymName">Salon adı</label>
          <input
            id="gymName"
            value={gymName}
            onChange={(e) => setGymName(e.target.value)}
            required
          />
        </div>
        <div className="row" style={{ marginBottom: 14 }}>
          <div className="field">
            <label htmlFor="lat">Enlem</label>
            <input
              id="lat"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="41.0082"
            />
          </div>
          <div className="field">
            <label htmlFor="lng">Boylam</label>
            <input
              id="lng"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              placeholder="28.9784"
            />
          </div>
          <div className="field">
            <label htmlFor="radiusM">Yarıçap (m)</label>
            <input
              id="radiusM"
              value={radiusM}
              onChange={(e) => setRadiusM(e.target.value)}
              placeholder="100"
            />
          </div>
        </div>
        <div className="row" style={{ marginBottom: 14 }}>
          <div className="field" style={{ maxWidth: 180 }}>
            <label htmlFor="capacity">Kapasite (kişi)</label>
            <input
              id="capacity"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="80"
            />
          </div>
          <div className="field" style={{ maxWidth: 260 }}>
            <label htmlFor="autoExitHours">Otomatik çıkış süresi (saat)</label>
            <input
              id="autoExitHours"
              type="number"
              min={1}
              value={autoExitHours}
              onChange={(e) => setAutoExitHours(e.target.value)}
              placeholder="12"
              required
            />
            <span className="hint">
              Çıkış turnikesi yoksa üye bu süre sonunda içeride sayılmaz.
            </span>
          </div>
        </div>
        <button type="submit" disabled={busy}>
          {busy ? "Kaydediliyor…" : "Kaydet"}
        </button>
      </form>
    </div>
  );
}
