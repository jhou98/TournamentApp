import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { ToastProvider } from "./components/Toast";
import type { Role } from "./lib/nav";
import { AppShell } from "./components/layout/AppShell";
import { Loading } from "./components/ui";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { Home } from "./pages/Home";
import { Profile } from "./pages/Profile";
import { Leaderboard } from "./pages/Leaderboard";
import { ComingSoon } from "./pages/ComingSoon";
import { TournamentHub } from "./pages/tournament/TournamentHub";
import { Schedule } from "./pages/tournament/Schedule";
import { Results } from "./pages/tournament/Results";
import { Standings } from "./pages/tournament/Standings";
import { Captain } from "./pages/Captain";
import { AdminHub } from "./pages/admin/AdminHub";
import { AdminUsers } from "./pages/admin/AdminUsers";
import { AdminTeams } from "./pages/admin/AdminTeams";
import { AdminCoins } from "./pages/admin/AdminCoins";
import { AdminTournaments } from "./pages/admin/AdminTournaments";
import { AdminSettings } from "./pages/admin/AdminSettings";

function FullPageLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loading />
    </div>
  );
}

/** Signed-in only; optionally restricted to certain roles. */
function RequireAuth({ children, roles }: { children: JSX.Element; roles?: Role[] }) {
  const { profile, loading } = useAuth();
  if (loading) return <FullPageLoading />;
  if (!profile) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(profile.role)) return <Navigate to="/" replace />;
  return children;
}

/** Login / signup: bounce already-authenticated users to Home. */
function PublicOnly({ children }: { children: JSX.Element }) {
  const { profile, loading } = useAuth();
  if (loading) return <FullPageLoading />;
  if (profile) return <Navigate to="/" replace />;
  return children;
}

function Shell() {
  const { activeTournamentId } = useAuth();
  return (
    // Remount routed pages when the active tournament changes so their
    // per-tournament data (US28) refetches on switch.
    <Routes key={activeTournamentId ?? "none"}>
      <Route
        path="/login"
        element={
          <PublicOnly>
            <Login />
          </PublicOnly>
        }
      />
      <Route
        path="/signup"
        element={
          <PublicOnly>
            <Signup />
          </PublicOnly>
        }
      />

      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<Home />} />
        <Route path="profile" element={<Profile />} />

        <Route path="tournament" element={<TournamentHub />}>
          <Route index element={<Navigate to="schedule" replace />} />
          <Route path="schedule" element={<Schedule />} />
          <Route path="results" element={<Results />} />
          <Route path="standings" element={<Standings />} />
        </Route>

        <Route
          path="captain"
          element={
            <RequireAuth roles={["captain", "admin"]}>
              <Captain />
            </RequireAuth>
          }
        />

        <Route
          path="admin"
          element={
            <RequireAuth roles={["admin"]}>
              <AdminHub />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="users" replace />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="teams" element={<AdminTeams />} />
          <Route path="coins" element={<AdminCoins />} />
          <Route path="tournaments" element={<AdminTournaments />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>

        <Route path="leaderboard" element={<Leaderboard />} />

        {/* Future phases — placeholders until the features ship (see lib/nav.ts). */}
        <Route path="shop" element={<ComingSoon />} />
        <Route path="missions" element={<ComingSoon />} />

        {/* Legacy flat routes from the first UI. */}
        <Route path="schedule" element={<Navigate to="/tournament/schedule" replace />} />
        <Route path="results" element={<Navigate to="/tournament/results" replace />} />
        <Route path="standings" element={<Navigate to="/tournament/standings" replace />} />
        <Route path="lineups" element={<Navigate to="/captain" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Shell />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
