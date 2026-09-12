import { useEffect, useState } from "react";
import { api } from "../lib/api";

interface Health {
  status: string;
  db: string;
}

export function Home() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Health>("/health")
      .then(setHealth)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
      <h1>Friendsgiving Badminton Tournament</h1>
      <p>Foundational scaffold is up.</p>
      <section>
        <h2>API health</h2>
        {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
        {!error && !health && <p>Checking…</p>}
        {health && (
          <p>
            API: <strong>{health.status}</strong> / db: <strong>{health.db}</strong>
          </p>
        )}
      </section>
    </main>
  );
}
