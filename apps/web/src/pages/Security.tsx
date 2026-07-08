import { useState } from "react";
import QRCode from "qrcode";
import { authApi } from "../lib/api";
import { useProfile } from "../lib/profile";

interface MfaSetup {
  qr: string;
  backupCodes: string[];
}

export function Security() {
  const { profile, refresh } = useProfile();
  const [password, setPassword] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [code, setCode] = useState("");
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: string; text: string } | null>(null);

  async function enable(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const data = await authApi<{ totpURI: string; backupCodes: string[] }>(
        "/two-factor/enable",
        { password },
      );
      const qr = await QRCode.toDataURL(data.totpURI);
      setSetup({ qr, backupCodes: data.backupCodes });
      setPassword("");
      setCopied(false);
    } catch {
      setMsg({ kind: "error", text: "Şifre hatalı." });
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await authApi("/two-factor/verify-totp", { code });
      setSetup(null);
      setCode("");
      setMsg({ kind: "success", text: "MFA etkinleştirildi." });
      await refresh();
    } catch {
      setMsg({ kind: "error", text: "Kod geçersiz veya süresi dolmuş." });
    } finally {
      setBusy(false);
    }
  }

  async function disable(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await authApi("/two-factor/disable", { password: disablePassword });
      setDisablePassword("");
      setMsg({ kind: "success", text: "MFA devre dışı bırakıldı." });
      await refresh();
    } catch {
      setMsg({ kind: "error", text: "Şifre hatalı." });
    } finally {
      setBusy(false);
    }
  }

  async function copyBackupCodes() {
    if (!setup) return;
    try {
      await navigator.clipboard.writeText(setup.backupCodes.join("\n"));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="stagger">
      <h1>Güvenlik</h1>
      <div className="panel" style={{ maxWidth: 560 }}>
        <h2>İki aşamalı doğrulama (MFA)</h2>
        <p style={{ marginBottom: 16 }}>
          {profile?.twoFactorEnabled ? (
            <span className="badge ok">MFA etkin</span>
          ) : (
            <span className="badge member">MFA kapalı</span>
          )}
        </p>
        {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}

        {!profile?.twoFactorEnabled && !setup && (
          <form className="row" onSubmit={enable}>
            <div className="field">
              <label htmlFor="enablePassword">Şifre</label>
              <input
                id="enablePassword"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <button type="submit" disabled={busy}>
              {busy ? "İşleniyor…" : "MFA'yı etkinleştir"}
            </button>
          </form>
        )}

        {setup && (
          <div>
            <div className="qr-box">
              <img src={setup.qr} alt="MFA QR kodu" />
            </div>
            <p className="hint" style={{ marginBottom: 16 }}>
              Authenticator uygulamanızla (Google Authenticator, Authy vb.)
              yukarıdaki QR kodu okutun.
            </p>
            <h3 style={{ marginBottom: 8 }}>Yedek kodlar</h3>
            <div className="code-block">{setup.backupCodes.join("\n")}</div>
            <div className="row" style={{ marginBottom: 14 }}>
              <button
                type="button"
                className="ghost"
                onClick={() => void copyBackupCodes()}
              >
                {copied ? "Kopyalandı" : "Kopyala"}
              </button>
            </div>
            <div className="msg warn">
              Yedek kodlar yalnızca şimdi görüntülenir; güvenli bir yere
              kaydedin.
            </div>
            <form onSubmit={verify} className="row" style={{ marginTop: 6 }}>
              <div className="field">
                <label htmlFor="totpCode">Doğrulama kodu</label>
                <input
                  id="totpCode"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoComplete="one-time-code"
                  required
                />
              </div>
              <button type="submit" disabled={busy}>
                {busy ? "Doğrulanıyor…" : "Doğrula"}
              </button>
            </form>
          </div>
        )}

        {profile?.twoFactorEnabled && (
          <form className="row" onSubmit={disable}>
            <div className="field">
              <label htmlFor="disablePassword">Şifre</label>
              <input
                id="disablePassword"
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <button type="submit" className="ghost" disabled={busy}>
              {busy ? "İşleniyor…" : "MFA'yı devre dışı bırak"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
