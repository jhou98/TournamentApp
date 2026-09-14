import { BrowserRouter, Navigate, Route, Routes, Link } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { Profile } from "./pages/Profile";
import { Admin } from "./pages/Admin";
import { Schedule } from "./pages/Schedule";
import { Lineups } from "./pages/Lineups";
import { Results } from "./pages/Results";
import { Standings } from "./pages/Standings";

function Nav() {
  const { profile, logout, tournaments, activeTournamentId, setActiveTournament } = useAuth();
  if (!profile) return null;
  return (
    <nav style={navStyle}>
      <Link to="/">Profile</Link>
      <Link to="/schedule">Schedule</Link>
      <Link to="/standings">Standings</Link>
      <Link to="/results">Results</Link>
      {(profile.role === "captain" || profile.role === "admin") && <Link to="/lineups">Lineups</Link>}
      {profile.role === "admin" && <Link to="/admin">Admin</Link>}
      <span style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center" }}>
        {tournaments.length > 1 ? (
          <select
            aria-label="Active tournament"
            value={activeTournamentId ?? ""}
            onChange={(e) => setActiveTournament(e.target.value)}
          >
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        ) : (
          tournaments.length === 1 && <span>{tournaments[0]!.name}</span>
        )}
        <span>
          {profile.user.displayName} ({profile.role})
        </span>
        <button onClick={() => logout()}>Log out</button>
      </span>
    </nav>
  );
}

function RequireAuth({ children, adminOnly }: { children: JSX.Element; adminOnly?: boolean }) {
  const { profile, loading } = useAuth();
  if (loading) return <p style={{ padding: 24 }}>Loading…</p>;
  if (!profile) return <Navigate to="/login" replace />;
  if (adminOnly && profile.role !== "admin") return <Navigate to="/" replace />;
  return children;
}

function Shell() {
  const { activeTournamentId } = useAuth();
  return (
    <div style={{ fontFamily: "system-ui, sans-serif" }}>
      <Nav />
      {/* Remount routed pages when the active tournament changes so their
          per-tournament data (US28) refetches on switch. */}
      <Routes key={activeTournamentId ?? "none"}>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Profile />
            </RequireAuth>
          }
        />
        <Route
          path="/schedule"
          element={
            <RequireAuth>
              <Schedule />
            </RequireAuth>
          }
        />
        <Route
          path="/standings"
          element={
            <RequireAuth>
              <Standings />
            </RequireAuth>
          }
        />
        <Route
          path="/results"
          element={
            <RequireAuth>
              <Results />
            </RequireAuth>
          }
        />
        <Route
          path="/lineups"
          element={
            <RequireAuth>
              <Lineups />
            </RequireAuth>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireAuth adminOnly>
              <Admin />
            </RequireAuth>
          }
        />
      </Routes>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </AuthProvider>
  );
}

const navStyle = {
  display: "flex",
  gap: 12,
  alignItems: "center",
  padding: "10px 16px",
  borderBottom: "1px solid #ddd",
} as const;
