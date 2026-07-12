import { useState } from "react";
import type {
  CreateSubscriptionRequest,
  MfaMethod,
  PublicUser,
  Subscription,
  SubscriptionMonths,
} from "@opengym/shared";
import { ApiError, api, authApi } from "../lib/api";
import { useProfile } from "../lib/profile";

const fmt = (iso: string) => new Date(iso).toLocaleDateString("tr-TR");
const subscriptionMonthOptions: readonly SubscriptionMonths[] = [1, 3, 6, 12];

function MemberAvatar({
  member,
  large = false,
}: {
  member: PublicUser;
  large?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const initials =
    `${member.firstName[0] ?? ""}${member.lastName[0] ?? ""}`.toLocaleUpperCase(
      "tr-TR",
    ) || "Ü";
  return (
    <span
      className={`member-avatar${large ? " member-avatar-large" : ""}`}
      aria-label={`${member.firstName} ${member.lastName} profil fotoğrafı`}
    >
      {member.profilePhotoUrl && !failed ? (
        <img
          src={member.profilePhotoUrl}
          alt=""
          onError={() => setFailed(true)}
        />
      ) : (
        initials
      )}
    </span>
  );
}

function subscriptionStatus(subscription: Subscription): {
  label: string;
  className: string;
} {
  const now = Date.now();
  if (new Date(subscription.startsAt).getTime() > now) {
    return { label: "Planlandı", className: "warn" };
  }
  if (new Date(subscription.endsAt).getTime() >= now) {
    return { label: "Aktif", className: "ok" };
  }
  return { label: "Bitti", className: "member" };
}

function SubscriptionPanel({ member }: { member: PublicUser }) {
  const [subs, setSubs] = useState<Subscription[] | null>(null);
  const [msg, setMsg] = useState<{ kind: string; text: string } | null>(null);
  const [months, setMonths] = useState<SubscriptionMonths>(1);

  async function load() {
    setSubs(
      await api<Subscription[]>(`/api/admin/users/${member.id}/subscriptions`),
    );
  }

  if (subs === null) {
    void load();
  }

  async function grant() {
    setMsg(null);
    try {
      const request: CreateSubscriptionRequest = {
        userId: member.id,
        months,
        note: `${months} aylık paket`,
      };
      await api("/api/admin/subscriptions", {
        method: "POST",
        body: request,
      });
      setMsg({ kind: "success", text: "Abonelik tanımlandı." });
      await load();
    } catch (err) {
      setMsg({
        kind: "error",
        text: err instanceof Error ? err.message : "İşlem başarısız.",
      });
    }
  }

  return (
    <div className="panel">
      <div className="member-detail-heading">
        <MemberAvatar member={member} large />
        <h2>
          Abonelik — {member.firstName} {member.lastName}
        </h2>
      </div>
      {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}
      <div className="row" style={{ marginBottom: 18 }}>
        <div className="field">
          <label htmlFor="months">Paket</label>
          <select
            id="months"
            value={months}
            onChange={(e) =>
              setMonths(Number(e.target.value) as SubscriptionMonths)
            }
          >
            {subscriptionMonthOptions.map((option) => (
              <option key={option} value={option}>
                {option} ay
              </option>
            ))}
          </select>
        </div>
        <button onClick={grant}>Abonelik tanımla</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Başlangıç</th>
            <th>Bitiş</th>
            <th>Not</th>
            <th>Durum</th>
          </tr>
        </thead>
        <tbody>
          {(subs ?? []).map((subscription) => {
            const status = subscriptionStatus(subscription);
            return (
              <tr key={subscription.id}>
                <td>{fmt(subscription.startsAt)}</td>
                <td>{fmt(subscription.endsAt)}</td>
                <td>{subscription.note ?? "—"}</td>
                <td>
                  <span className={`badge ${status.className}`}>
                    {status.label}
                  </span>
                </td>
              </tr>
            );
          })}
          {subs?.length === 0 && (
            <tr>
              <td colSpan={4}>Abonelik kaydı yok.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

interface MfaPrompt {
  target: PublicUser;
  role: string;
}

export function Members() {
  const { profile: user } = useProfile();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicUser[] | null>(null);
  const [selected, setSelected] = useState<PublicUser | null>(null);
  const [msg, setMsg] = useState<{ kind: string; text: string } | null>(null);

  const [mfaPrompt, setMfaPrompt] = useState<MfaPrompt | null>(null);
  const [mfaMethod, setMfaMethod] = useState<MfaMethod>("totp");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mfaInfo, setMfaInfo] = useState<string | null>(null);
  const [mfaBusy, setMfaBusy] = useState(false);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setSelected(null);
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      setMsg({ kind: "error", text: "Arama için en az iki karakter girin." });
      return;
    }
    try {
      setResults(
        await api<PublicUser[]>(`/api/admin/users?q=${encodeURIComponent(q)}`),
      );
    } catch (err) {
      setResults(null);
      setMsg({
        kind: "error",
        text: err instanceof Error ? err.message : "Arama başarısız.",
      });
    }
  }

  async function applyRole(
    target: PublicUser,
    role: string,
    mfa?: { mfaCode: string; mfaMethod: MfaMethod },
  ) {
    await api(`/api/admin/users/${target.id}/role`, {
      method: "POST",
      body: { role, ...mfa },
    });
    setMsg({
      kind: "success",
      text: `${target.email} → ${role} olarak güncellendi.`,
    });
    setResults(
      (prev) =>
        prev?.map((u) =>
          u.id === target.id ? { ...u, role: role as PublicUser["role"] } : u,
        ) ?? null,
    );
  }

  async function setRole(target: PublicUser, role: string) {
    setMsg(null);
    try {
      await applyRole(target, role);
    } catch (err) {
      if (err instanceof ApiError && err.code === "MFA_REQUIRED") {
        setMfaPrompt({ target, role });
        setMfaMethod("totp");
        setMfaCode("");
        setMfaError(null);
        setMfaInfo(null);
        return;
      }
      setMsg({
        kind: "error",
        text: err instanceof Error ? err.message : "Rol atanamadı.",
      });
    }
  }

  async function chooseMfaMethod(method: MfaMethod) {
    setMfaMethod(method);
    setMfaCode("");
    setMfaError(null);
    setMfaInfo(null);
    if (method === "otp") {
      try {
        await authApi("/two-factor/send-otp", {});
        setMfaInfo("Kod e-postanıza gönderildi.");
      } catch (err) {
        setMfaError(err instanceof Error ? err.message : "Kod gönderilemedi.");
      }
    }
  }

  async function confirmMfa() {
    if (!mfaPrompt) return;
    setMfaBusy(true);
    setMfaError(null);
    try {
      await applyRole(mfaPrompt.target, mfaPrompt.role, {
        mfaCode,
        mfaMethod,
      });
      setMfaPrompt(null);
    } catch (err) {
      if (err instanceof ApiError && err.code === "MFA_INVALID") {
        setMfaError("Kod geçersiz.");
      } else {
        setMfaError(
          err instanceof Error ? err.message : "Doğrulama başarısız.",
        );
      }
    } finally {
      setMfaBusy(false);
    }
  }

  return (
    <div className="stagger">
      <h1>Üyeler</h1>
      <div className="panel">
        <form className="row" onSubmit={search}>
          <div className="field">
            <label htmlFor="member-query">
              Telefon, e-posta, ad veya soyad
            </label>
            <input
              id="member-query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ayşe Yılmaz, ayse@… veya +90530…"
              minLength={2}
              required
            />
          </div>
          <button type="submit">Ara</button>
        </form>
      </div>
      {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}
      {results && (
        <div className="panel">
          <h2>Sonuçlar</h2>
          <table>
            <thead>
              <tr>
                <th>Ad Soyad</th>
                <th>Telefon</th>
                <th>E-posta</th>
                <th>Rol</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {results.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="member-identity">
                      <MemberAvatar member={u} />
                      <span>
                        {u.firstName} {u.lastName}
                      </span>
                    </div>
                  </td>
                  <td>{u.phone}</td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`badge ${u.role}`}>{u.role}</span>
                  </td>
                  <td>
                    <div className="row">
                      {user?.role === "admin" && u.id !== user.id && (
                        <select
                          value={u.role}
                          onChange={(e) => setRole(u, e.target.value)}
                        >
                          <option value="member">member</option>
                          <option value="staff">staff</option>
                          <option value="admin">admin</option>
                        </select>
                      )}
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => setSelected(u)}
                      >
                        Abonelik
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {results.length === 0 && (
                <tr>
                  <td colSpan={5}>Eşleşen üye bulunamadı.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {selected && <SubscriptionPanel key={selected.id} member={selected} />}
      {mfaPrompt && (
        <div className="modal-overlay">
          <div className="panel">
            <h2>MFA doğrulama gerekli</h2>
            <p className="hint" style={{ marginBottom: 16 }}>
              {mfaPrompt.target.email} kullanıcısının rolünü {mfaPrompt.role}{" "}
              olarak değiştirmek için doğrulama kodu girin.
            </p>
            {mfaError && <div className="msg error">{mfaError}</div>}
            {mfaInfo && <div className="msg success">{mfaInfo}</div>}
            <div className="row" style={{ marginBottom: 16 }}>
              <button
                type="button"
                className={mfaMethod === "totp" ? "" : "ghost"}
                onClick={() => void chooseMfaMethod("totp")}
              >
                Authenticator
              </button>
              <button
                type="button"
                className={mfaMethod === "otp" ? "" : "ghost"}
                onClick={() => void chooseMfaMethod("otp")}
              >
                E-posta kodu
              </button>
            </div>
            <div className="field">
              <label htmlFor="mfaCode">Doğrulama kodu</label>
              <input
                id="mfaCode"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                autoComplete="one-time-code"
                autoFocus
                required
              />
            </div>
            <div className="row">
              <button
                type="button"
                onClick={() => void confirmMfa()}
                disabled={mfaBusy || !mfaCode}
              >
                {mfaBusy ? "Doğrulanıyor…" : "Onayla"}
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => setMfaPrompt(null)}
                disabled={mfaBusy}
              >
                Vazgeç
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
