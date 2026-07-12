import { BrowserRouter, NavLink, Navigate, Route, Routes } from "react-router-dom";
import { authClient, useSessionUser } from "./lib/auth";
import { ProfileProvider, useProfile } from "./lib/profile";
import { Login } from "./pages/Login";
import { ChangePassword } from "./pages/ChangePassword";
import { Overview } from "./pages/Overview";
import { Members } from "./pages/Members";
import { Settings } from "./pages/Settings";
import { Audit } from "./pages/Audit";
import { Devices } from "./pages/Devices";
import { Entries } from "./pages/Entries";
import { Security } from "./pages/Security";
import { Kvkk } from "./pages/Kvkk";

const todayLabel = new Date()
  .toLocaleDateString("tr-TR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  })
  .toUpperCase();

function Shell({ children }: { children: React.ReactNode }) {
  const { refetch } = useSessionUser();
  const { profile } = useProfile();
  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-left">
          <div className="brand">
            Open<em>Gym</em>
          </div>
          <nav className="nav">
            <NavLink to="/overview">Genel Bakış</NavLink>
            <NavLink to="/members">Üyeler</NavLink>
            <NavLink to="/entries">Geçişler</NavLink>
            <NavLink to="/security">Güvenlik</NavLink>
            {profile?.role === "admin" && (
              <NavLink to="/devices">Cihazlar</NavLink>
            )}
            {profile?.role === "admin" && (
              <NavLink to="/settings">Ayarlar</NavLink>
            )}
            {profile?.role === "admin" && (
              <NavLink to="/audit">İşlem kaydı</NavLink>
            )}
            {profile?.role === "admin" && <NavLink to="/kvkk">KVKK</NavLink>}
          </nav>
        </div>
        <div className="topbar-right">
          <span className="topbar-date">{todayLabel}</span>
          <span className="topbar-who">
            {profile?.role?.toUpperCase()} · {profile?.email}
          </span>
          <button
            className="ghost"
            onClick={() => authClient.signOut().then(() => refetch())}
          >
            Çıkış
          </button>
        </div>
      </header>
      <main className="content">{children}</main>
    </div>
  );
}

function Gate() {
  const { user, isPending, refetch } = useSessionUser();
  const { profile, loading, refresh } = useProfile();

  if (isPending || (user && loading)) {
    return <div className="auth-wrap">Yükleniyor…</div>;
  }
  if (!user || !profile) {
    return <Login />;
  }
  if (profile.mustChangePassword) {
    return <ChangePassword onDone={() => refresh()} />;
  }
  if (profile.role === "member") {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <h1>Yetkisiz</h1>
          <p className="sub">
            Bu panel salon personeli içindir. Mobil uygulamayı kullanın.
          </p>
          <button onClick={() => authClient.signOut().then(() => refetch())}>
            Çıkış
          </button>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Shell>
        <Routes>
          <Route path="/overview" element={<Overview />} />
          <Route path="/members" element={<Members />} />
          <Route path="/entries" element={<Entries />} />
          <Route path="/security" element={<Security />} />
          {profile.role === "admin" && (
            <Route path="/devices" element={<Devices />} />
          )}
          {profile.role === "admin" && (
            <Route path="/settings" element={<Settings />} />
          )}
          {profile.role === "admin" && (
            <Route path="/audit" element={<Audit />} />
          )}
          {profile.role === "admin" && (
            <Route path="/kvkk" element={<Kvkk />} />
          )}
          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Routes>
      </Shell>
    </BrowserRouter>
  );
}

export function App() {
  const { user } = useSessionUser();
  return (
    <ProfileProvider enabled={!!user}>
      <Gate />
    </ProfileProvider>
  );
}
