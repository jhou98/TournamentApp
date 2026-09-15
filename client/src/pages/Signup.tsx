import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { AuthLayout } from "../components/layout/AuthLayout";
import { Alert, Button, Field, Input } from "../components/ui";

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
        inviteCode: inviteCode.trim(),
      });
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className="text-center text-2xl font-extrabold">Create your account</h1>
      <p className="mt-1 text-center text-sm text-ink-muted">Join the Friendsgiving tournament</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Field label="Username">
          <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
        </Field>
        <Field label="Display name">
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="name"
            required
          />
        </Field>
        <Field label="Password">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </Field>
        <Field label="Registration code" hint="Ask the commissioner for the code (or use your personal invite)">
          <Input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} autoComplete="off" required />
        </Field>

        {error && <Alert tone="error">{error}</Alert>}

        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Signing up…" : "Sign up"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-muted">
        Already have an account? <Link to="/login" className="link">Log in</Link>
      </p>
    </AuthLayout>
  );
}
