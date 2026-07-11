import { useState } from "react";
import { authApi, ApiError } from "../lib/api";
import { useSessionUser } from "../lib/auth";

type Step = "password" | "code" | "forgot" | "reset";
type Method = "totp" | "otp";

export function Login() {
  const { refetch } = useSessionUser();
  const [step, setStep] = useState<Step>("password");
  const [method, setMethod] = useState<Method>("totp");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
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

  function goToForgot() {
    setStep("forgot");
    setError(null);
    setInfo(null);
  }

  function backToPasswordFromForgot() {
    setStep("password");
    setError(null);
    setInfo(null);
  }

  function backToPasswordFromReset() {
    setStep("password");
    setResetOtp("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setInfo(null);
  }

  function forgotErrorMessage(err: unknown): string {
    if (err instanceof ApiError && err.status === 429) {
      return "Çok fazla deneme. Lütfen bir dakika bekleyin.";
    }
    return "İstek gönderilemedi. Lütfen tekrar deneyin.";
  }

  async function requestResetCode() {
    await authApi("/email-otp/request-password-reset", { email });
  }

  async function submitForgot(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await requestResetCode();
      setInfo("Şifre sıfırlama kodu e-postanıza gönderildi.");
      setStep("reset");
    } catch (err) {
      setError(forgotErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function resendResetCode() {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await requestResetCode();
      setResetOtp("");
      setInfo("Yeni kod e-postanıza gönderildi.");
    } catch (err) {
      setError(forgotErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (newPassword.length < 8) {
      setError("Şifre en az 8 karakter olmalı.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Şifreler eşleşmiyor.");
      return;
    }
    setBusy(true);
    try {
      await authApi("/email-otp/reset-password", {
        email,
        otp: resetOtp,
        password: newPassword,
      });
      setStep("password");
      setPassword("");
      setResetOtp("");
      setNewPassword("");
      setConfirmPassword("");
      setError(null);
      setInfo("Şifreniz güncellendi. Lütfen giriş yapın.");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 429) {
          setError("Çok fazla deneme. Lütfen bir dakika bekleyin.");
        } else if (err.code === "INVALID_OTP") {
          setError("Kod geçersiz.");
        } else if (err.code === "OTP_EXPIRED") {
          setError("Kodun süresi doldu.");
        } else if (err.code === "TOO_MANY_ATTEMPTS") {
          setError("Çok fazla hatalı deneme yapıldı. Yeni kod isteyin.");
        } else if (err.code === "PASSWORD_TOO_SHORT") {
          setError("Şifre çok kısa.");
        } else {
          setError("Şifre sıfırlama başarısız.");
        }
      } else {
        setError("Şifre sıfırlama başarısız.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (step === "forgot") {
    return (
      <div className="auth-wrap">
        <form className="auth-card" onSubmit={submitForgot}>
          <h1>
            Open
            <em style={{ color: "var(--accent)", fontStyle: "normal" }}>Gym</em>
          </h1>
          <p className="sub">Şifre sıfırlama</p>
          {error && <div className="msg error">{error}</div>}
          {info && <div className="msg success">{info}</div>}
          <div className="field">
            <label htmlFor="forgot-email">E-posta</label>
            <input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </div>
          <button type="submit" disabled={busy} style={{ width: "100%" }}>
            {busy ? "Gönderiliyor…" : "Sıfırlama kodu gönder"}
          </button>
          <div className="row" style={{ marginTop: 16 }}>
            <button
              type="button"
              className="link-btn"
              onClick={backToPasswordFromForgot}
              disabled={busy}
            >
              Geri
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (step === "reset") {
    return (
      <div className="auth-wrap">
        <form className="auth-card" onSubmit={submitReset}>
          <h1>
            Open
            <em style={{ color: "var(--accent)", fontStyle: "normal" }}>Gym</em>
          </h1>
          <p className="sub">Yeni şifre belirleyin</p>
          {error && <div className="msg error">{error}</div>}
          {info && <div className="msg success">{info}</div>}
          <div className="field">
            <label htmlFor="reset-email">E-posta</label>
            <input
              id="reset-email"
              type="email"
              value={email}
              readOnly
              autoComplete="username"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="reset-otp">Doğrulama kodu</label>
            <input
              id="reset-otp"
              value={resetOtp}
              onChange={(e) => setResetOtp(e.target.value)}
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              required
            />
          </div>
          <div className="field">
            <label htmlFor="new-password">Yeni şifre</label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="confirm-password">Yeni şifre (tekrar)</label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          <button type="submit" disabled={busy} style={{ width: "100%" }}>
            {busy ? "Güncelleniyor…" : "Şifreyi güncelle"}
          </button>
          <div
            className="row"
            style={{ marginTop: 16, justifyContent: "space-between" }}
          >
            <button
              type="button"
              className="link-btn"
              onClick={backToPasswordFromReset}
              disabled={busy}
            >
              Geri
            </button>
            <button
              type="button"
              className="link-btn"
              onClick={() => void resendResetCode()}
              disabled={busy}
            >
              Kodu tekrar gönder
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (step === "code") {
    return (
      <div className="auth-wrap">
        <form className="auth-card" onSubmit={submitCode}>
          <h1>
            Open
            <em style={{ color: "var(--accent)", fontStyle: "normal" }}>Gym</em>
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
          Open
          <em style={{ color: "var(--accent)", fontStyle: "normal" }}>Gym</em>
        </h1>
        <p className="sub">Yönetim paneli — personel girişi</p>
        {error && <div className="msg error">{error}</div>}
        {info && <div className="msg success">{info}</div>}
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
        <div
          className="row"
          style={{ marginTop: 16, justifyContent: "flex-end" }}
        >
          <button
            type="button"
            className="link-btn"
            onClick={goToForgot}
            disabled={busy}
          >
            Şifremi unuttum?
          </button>
        </div>
      </form>
    </div>
  );
}
