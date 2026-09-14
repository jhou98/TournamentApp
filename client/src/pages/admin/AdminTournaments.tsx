import { useState } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { Alert, Button, Card, Field, Input, Pill, StatusPill } from "../../components/ui";
import { Icon } from "../../components/Icon";

export function AdminTournaments() {
  const { tournaments, activeTournamentId, setActiveTournament, refresh } = useAuth();
  const [newTournament, setNewTournament] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function createTournament() {
    setError(null);
    try {
      const { tournament } = await api<{ tournament: { id: string } }>("/admin/tournaments", {
        method: "POST",
        body: JSON.stringify({ name: newTournament.trim() }),
      });
      setNewTournament("");
      await refresh(); // pull the new tournament into the accessible list
      await setActiveTournament(tournament.id); // and switch to it
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create tournament");
    }
  }

  return (
    <>
      {error && <Alert tone="error">{error}</Alert>}

      <Card title="Create tournament" className="mb-5">
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Tournament name" className="w-64">
            <Input
              placeholder="New tournament name"
              value={newTournament}
              onChange={(e) => setNewTournament(e.target.value)}
            />
          </Field>
          <Button icon="plus" disabled={!newTournament.trim()} onClick={() => createTournament()}>
            Create tournament
          </Button>
        </div>
        <p className="mt-3 text-xs text-ink-muted">
          New tournaments start from the default config: 4 teams of 6, 3-round round robin, 6 courts.
        </p>
      </Card>

      <div className="space-y-3">
        {tournaments.map((t) => (
          <Card key={t.id} bodyClassName="flex items-center gap-3 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
              <Icon name="trophy" size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold">{t.name}</span>
                <StatusPill status={t.status} />
              </div>
            </div>
            {t.id === activeTournamentId ? (
              <Pill tone="success" icon="check">
                Active
              </Pill>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => setActiveTournament(t.id)}>
                Make active
              </Button>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}
