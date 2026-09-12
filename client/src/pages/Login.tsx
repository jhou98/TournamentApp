import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../lib/auth";

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(username, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: "3rem auto" }}>
      <h1>Log in</h1>
      <form onSubmit={onSubmit}>
        <label style={{ display: "block", marginBottom: 8 }}>
          Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: "block", marginBottom: 8 }}>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />
        </label>
        {error && <p style={{ color: "crimson" }}>{error}</p>}
        <button type="submit" disabled={busy}>
          {busy ? "…" : "Log in"}
        </button>
      </form>
      <p style={{ marginTop: 16 }}>
        No account? <Link to="/signup">Sign up</Link>
      </p>
    </div>
  );
}

const inputStyle = { display: "block", width: "100%", padding: 6, marginTop: 2 } as const;
