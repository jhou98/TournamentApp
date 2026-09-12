import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../lib/auth";

export function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signup({
        username,
        password,
        displayName,
        inviteCode: inviteCode.trim() || undefined,
      });
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: "3rem auto" }}>
      <h1>Sign up</h1>
      <form onSubmit={onSubmit}>
        <label style={{ display: "block", marginBottom: 8 }}>
          Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: "block", marginBottom: 8 }}>
          Display name
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={inputStyle} />
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
        <label style={{ display: "block", marginBottom: 8 }}>
          Invite code (optional)
          <input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} style={inputStyle} />
        </label>
        {error && <p style={{ color: "crimson" }}>{error}</p>}
        <button type="submit" disabled={busy}>
          {busy ? "…" : "Sign up"}
        </button>
      </form>
      <p style={{ marginTop: 16 }}>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}

const inputStyle = { display: "block", width: "100%", padding: 6, marginTop: 2 } as const;
