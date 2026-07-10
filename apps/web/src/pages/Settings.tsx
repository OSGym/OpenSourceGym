import { useEffect, useState } from "react";
import type { GymSettings, SharingConfig } from "@opengym/shared";
import { api } from "../lib/api";

const defaultSharing: SharingConfig = {
  memberMaxSessions: 2,
  staffMaxSessions: 5,
  signalThreshold: 3,
  signalWindowHours: 24,
  qrBlockHours: 24,
};

export function Settings() {
  const [gymName, setGymName] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [radiusM, setRadiusM] = useState("");
  const [capacity, setCapacity] = useState("");
  const [autoExitHours, setAutoExitHours] = useState("");
  const [sharing, setSharing] = useState<SharingConfig>(defaultSharing);
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
      setSharing(s.sharing);
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
          sharing,
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
        <h2>Hesap paylaşımı tespiti</h2>
        <div className="row" style={{ marginBottom: 14 }}>
          <div className="field">
            <label htmlFor="memberMaxSessions">
              Üye başına eşzamanlı oturum sınırı
            </label>
            <input
              id="memberMaxSessions"
              type="number"
              min={1}
              max={10}
              value={sharing.memberMaxSessions}
              onChange={(e) =>
                setSharing({
                  ...sharing,
                  memberMaxSessions: Number(e.target.value),
                })
              }
              required
            />
            <span className="hint">
              Bu sınır aşıldığında en eski oturum otomatik kapatılır.
            </span>
          </div>
          <div className="field">
            <label htmlFor="staffMaxSessions">
              Personel/admin başına eşzamanlı oturum sınırı
            </label>
            <input
              id="staffMaxSessions"
              type="number"
              min={1}
              max={20}
              value={sharing.staffMaxSessions}
              onChange={(e) =>
                setSharing({
                  ...sharing,
                  staffMaxSessions: Number(e.target.value),
                })
              }
              required
            />
            <span className="hint">
              Personel ve adminler için eşzamanlı oturum üst sınırı.
            </span>
          </div>
          <div className="field">
            <label htmlFor="signalThreshold">
              Otomatik engel için sinyal eşiği
            </label>
            <input
              id="signalThreshold"
              type="number"
              min={1}
              max={20}
              value={sharing.signalThreshold}
              onChange={(e) =>
                setSharing({
                  ...sharing,
                  signalThreshold: Number(e.target.value),
                })
              }
              required
            />
            <span className="hint">
              Bu sayıda şüpheli sinyal birikince hesap otomatik engellenir.
            </span>
          </div>
        </div>
        <div className="row" style={{ marginBottom: 14 }}>
          <div className="field">
            <label htmlFor="signalWindowHours">Sinyal penceresi (saat)</label>
            <input
              id="signalWindowHours"
              type="number"
              min={1}
              max={168}
              value={sharing.signalWindowHours}
              onChange={(e) =>
                setSharing({
                  ...sharing,
                  signalWindowHours: Number(e.target.value),
                })
              }
              required
            />
            <span className="hint">Sinyallerin sayıldığı zaman aralığı.</span>
          </div>
          <div className="field">
            <label htmlFor="qrBlockHours">QR engeli süresi (saat)</label>
            <input
              id="qrBlockHours"
              type="number"
              min={1}
              max={168}
              value={sharing.qrBlockHours}
              onChange={(e) =>
                setSharing({
                  ...sharing,
                  qrBlockHours: Number(e.target.value),
                })
              }
              required
            />
            <span className="hint">Otomatik engelin ne kadar süreceği.</span>
          </div>
        </div>
        <button type="submit" disabled={busy}>
          {busy ? "Kaydediliyor…" : "Kaydet"}
        </button>
      </form>
    </div>
  );
}
