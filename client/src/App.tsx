import { BrowserRouter, Navigate, Route, Routes, Link } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { Profile } from "./pages/Profile";
import { Admin } from "./pages/Admin";

function Nav() {
  const { profile, logout } = useAuth();
  if (!profile) return null;
  return (
    <nav style={navStyle}>
      <Link to="/">Profile</Link>
      {profile.role === "admin" && <Link to="/admin">Admin</Link>}
      <span style={{ marginLeft: "auto" }}>
        {profile.user.displayName} ({profile.role})
      </span>
      <button onClick={() => logout()}>Log out</button>
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
  return (
    <div style={{ fontFamily: "system-ui, sans-serif" }}>
      <Nav />
      <Routes>
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
