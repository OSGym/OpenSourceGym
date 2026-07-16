import { useState } from "react";
import { useTranslation } from "react-i18next";
import QRCode from "qrcode";
import { authApi } from "../lib/api";
import { useProfile } from "../lib/profile";

interface MfaSetup {
  qr: string;
  backupCodes: string[];
}

export function Security() {
  const { t } = useTranslation();
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
      setMsg({ kind: "error", text: t("Şifre hatalı.") });
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
      setMsg({ kind: "success", text: t("MFA etkinleştirildi.") });
      await refresh();
    } catch {
      setMsg({
        kind: "error",
        text: t("Kod geçersiz veya süresi dolmuş."),
      });
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
      setMsg({ kind: "success", text: t("MFA devre dışı bırakıldı.") });
      await refresh();
    } catch {
      setMsg({ kind: "error", text: t("Şifre hatalı.") });
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
      <h1>{t("Güvenlik")}</h1>
      <div className="panel" style={{ maxWidth: 560 }}>
        <h2>{t("İki aşamalı doğrulama (MFA)")}</h2>
        <p style={{ marginBottom: 16 }}>
          {profile?.twoFactorEnabled ? (
            <span className="badge ok">{t("MFA etkin")}</span>
          ) : (
            <span className="badge member">{t("MFA kapalı")}</span>
          )}
        </p>
        {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}

        {!profile?.twoFactorEnabled && !setup && (
          <form className="row" onSubmit={enable}>
            <div className="field">
              <label htmlFor="enablePassword">{t("Şifre")}</label>
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
              {busy ? t("İşleniyor…") : t("MFA'yı etkinleştir")}
            </button>
          </form>
        )}

        {setup && (
          <div>
            <div className="qr-box">
              <img src={setup.qr} alt={t("MFA QR kodu")} />
            </div>
            <p className="hint" style={{ marginBottom: 16 }}>
              {t(
                "Authenticator uygulamanızla (Google Authenticator, Authy vb.) yukarıdaki QR kodu okutun.",
              )}
            </p>
            <h3 style={{ marginBottom: 8 }}>{t("Yedek kodlar")}</h3>
            <div className="code-block">{setup.backupCodes.join("\n")}</div>
            <div className="row" style={{ marginBottom: 14 }}>
              <button
                type="button"
                className="ghost"
                onClick={() => void copyBackupCodes()}
              >
                {copied ? t("Kopyalandı") : t("Kopyala")}
              </button>
            </div>
            <div className="msg warn">
              {t(
                "Yedek kodlar yalnızca şimdi görüntülenir; güvenli bir yere kaydedin.",
              )}
            </div>
            <form onSubmit={verify} className="row" style={{ marginTop: 6 }}>
              <div className="field">
                <label htmlFor="totpCode">{t("Doğrulama kodu")}</label>
                <input
                  id="totpCode"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoComplete="one-time-code"
                  required
                />
              </div>
              <button type="submit" disabled={busy}>
                {busy ? t("Doğrulanıyor…") : t("Doğrula")}
              </button>
            </form>
          </div>
        )}

        {profile?.twoFactorEnabled && (
          <form className="row" onSubmit={disable}>
            <div className="field">
              <label htmlFor="disablePassword">{t("Şifre")}</label>
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
              {busy ? t("İşleniyor…") : t("MFA'yı devre dışı bırak")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
