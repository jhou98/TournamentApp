import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { MyMissionView } from "../lib/types";
import { Icon } from "../components/Icon";
import { useToast } from "../components/Toast";
import { Alert, Button, Card, EmptyState, Loading, PageHeader } from "../components/ui";

/** A player's own secret missions (US23) — only they and admins can see these. */
export function Missions() {
  const { activeTournamentId } = useAuth();
  const { showToast } = useToast();
  const [missions, setMissions] = useState<MyMissionView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setError(null);
    api<{ missions: MyMissionView[] }>("/missions")
      .then((d) => setMissions(d.missions))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }

  useEffect(() => {
    setMissions(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTournamentId]);

  async function complete(id: string) {
    try {
      await api(`/missions/${id}/complete`, { method: "POST" });
      setMissions((cur) => cur?.filter((m) => m.id !== id) ?? cur);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not complete mission", "error");
    }
  }

  return (
    <>
      <PageHeader title="Missions" subtitle="Secret challenges just for you" />

      <Alert tone="info">
        Let your commissioner know before you start a challenge so they can witness it.
      </Alert>

      {error && <Alert tone="error">{error}</Alert>}
      {missions === null && !error && <Loading />}

      {missions && missions.length === 0 && (
        <EmptyState icon="target" title="No missions yet" hint="Your commissioner can assign you one any time." />
      )}

      {missions && missions.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {missions.map((m) => (
            <MissionCard key={m.id} mission={m} onComplete={complete} />
          ))}
        </div>
      )}
    </>
  );
}

function MissionCard({ mission: m, onComplete }: { mission: MyMissionView; onComplete: (id: string) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function confirmComplete() {
    setBusy(true);
    try {
      await onComplete(m.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
          <Icon name="target" size={18} />
        </div>
        <div className="min-w-0">
          <p className="font-semibold">{m.description}</p>
          <p className="mt-1 text-sm text-ink-muted">
            Prize: <span className="font-semibold text-ink">{m.prize}</span>
          </p>
        </div>
      </div>

      {confirming ? (
        <div className="mt-3 rounded-ctl border border-line-strong bg-sand p-3">
          <p className="text-sm">Show your commissioner what you did, then press Continue.</p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" icon="check" disabled={busy} onClick={confirmComplete}>
              Continue
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <Button variant="secondary" size="sm" onClick={() => setConfirming(true)}>
            Complete
          </Button>
        </div>
      )}
    </Card>
  );
}
