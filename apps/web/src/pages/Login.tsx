import { useState } from "react";
import { authApi } from "../lib/api";
import { useSessionUser } from "../lib/auth";

type Step = "password" | "code";
type Method = "totp" | "otp";

export function Login() {
  const { refetch } = useSessionUser();
  const [step, setStep] = useState<Step>("password");
  const [method, setMethod] = useState<Method>("totp");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await authApi<{ twoFactorRedirect?: boolean }>(
        "/sign-in/email",
        { email, password },
      );
      if (data.twoFactorRedirect) {
        setStep("code");
        setMethod("totp");
        setCode("");
        setInfo(null);
      } else {
        await refetch();
        // Başarıda useSession güncellenir, router yönlendirir
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Giriş başarısız.");
    } finally {
      setBusy(false);
    }
  }

  async function sendEmailCode() {
    setBusy(true);
    setError(null);
    try {
      await authApi("/two-factor/send-otp", {});
      setMethod("otp");
      setCode("");
      setInfo("Kod e-postanıza gönderildi.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kod gönderilemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const path =
        method === "totp"
          ? "/two-factor/verify-totp"
          : "/two-factor/verify-otp";
      await authApi(path, { code });
      await refetch();
      // Başarıda useSession güncellenir, router yönlendirir
    } catch {
      setError("Kod geçersiz veya süresi dolmuş.");
    } finally {
      setBusy(false);
    }
  }

  function backToPassword() {
    setStep("password");
    setCode("");
    setError(null);
    setInfo(null);
    setMethod("totp");
  }

  if (step === "code") {
    return (
      <div className="auth-wrap">
        <form className="auth-card" onSubmit={submitCode}>
          <h1>
            Open
            <em style={{ color: "var(--accent)", fontStyle: "normal" }}>
              Gym
            </em>
          </h1>
          <p className="sub">İki aşamalı doğrulama</p>
          {error && <div className="msg error">{error}</div>}
          {info && <div className="msg success">{info}</div>}
          <div className="field">
            <label htmlFor="code">Doğrulama kodu</label>
            <input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="one-time-code"
              autoFocus
              required
            />
          </div>
          <button type="submit" disabled={busy} style={{ width: "100%" }}>
            {busy ? "Doğrulanıyor…" : "Doğrula"}
          </button>
          <div
            className="row"
            style={{ marginTop: 16, justifyContent: "space-between" }}
          >
            <button
              type="button"
              className="link-btn"
              onClick={backToPassword}
              disabled={busy}
            >
              Geri
            </button>
            {method === "totp" && (
              <button
                type="button"
                className="link-btn"
                onClick={() => void sendEmailCode()}
                disabled={busy}
              >
                E-posta ile kod gönder
              </button>
            )}
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submitPassword}>
        <h1>
          Open<em style={{ color: "var(--accent)", fontStyle: "normal" }}>Gym</em>
        </h1>
        <p className="sub">Yönetim paneli — personel girişi</p>
        {error && <div className="msg error">{error}</div>}
        <div className="field">
          <label htmlFor="email">E-posta</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="password">Şifre</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        <button type="submit" disabled={busy} style={{ width: "100%" }}>
          {busy ? "Giriş yapılıyor…" : "Giriş yap"}
        </button>
      </form>
    </div>
  );
}
