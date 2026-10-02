import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { AuthLayout } from "../components/layout/AuthLayout";
import { Alert, Button, Field, Input } from "../components/ui";

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "reset">("login");
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

  if (mode === "reset") {
    return (
      <ResetPasswordForm
        initialUsername={username}
        onDone={(resetUsername) => {
          setUsername(resetUsername);
          setPassword("");
          setMode("login");
        }}
        onCancel={() => setMode("login")}
      />
    );
  }

  return (
    <AuthLayout>
      <h1 className="text-center text-2xl font-extrabold">Welcome Back</h1>
      <p className="mt-1 text-center text-sm text-ink-muted">Log in to your account to continue</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Field label="Username">
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </Field>
        <Field label="Password">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </Field>

        {error && <Alert tone="error">{error}</Alert>}

        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Logging in…" : "Log in"}
        </Button>
      </form>

      <p className="mt-3 text-center text-sm">
        <button type="button" className="link" onClick={() => setMode("reset")}>
          Forgot password?
        </button>
      </p>

      <p className="mt-6 text-center text-sm text-ink-muted">
        Don't have an account? <Link to="/signup" className="link">Sign up</Link>
      </p>
    </AuthLayout>
  );
}

function ResetPasswordForm({
  initialUsername,
  onDone,
  onCancel,
}: {
  initialUsername: string;
  onDone: (username: string) => void;
  onCancel: () => void;
}) {
  const { resetPassword } = useAuth();
  const [username, setUsername] = useState(initialUsername);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    setBusy(true);
    try {
      await resetPassword({ username, code: code.trim(), newPassword });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password");
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return (
      <AuthLayout>
        <h1 className="text-center text-2xl font-extrabold">Password updated</h1>
        <p className="mt-2 text-center text-sm text-ink-muted">
          Your password has been reset. You can log in with it now.
        </p>
        <Button className="mt-6 w-full" onClick={() => onDone(username)}>
          Back to log in
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h1 className="text-center text-2xl font-extrabold">Reset your password</h1>
      <p className="mt-1 text-center text-sm text-ink-muted">
        Enter your username and a new password
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Field label="Username">
          <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
        </Field>
        <Field label="Registration code" hint="The shared code (ask the commissioner) — or the admin bootstrap code for an admin account">
          <Input value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" required />
        </Field>
        <Field label="New password">
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </Field>
        <Field label="Confirm new password">
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </Field>

        {error && <Alert tone="error">{error}</Alert>}

        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Resetting…" : "Reset password"}
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={onCancel}>
          Back to log in
        </Button>
      </form>
    </AuthLayout>
  );
}
