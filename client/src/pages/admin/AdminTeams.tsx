import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { Alert, Avatar, Button, Card, EmptyState, Input, Pill, TeamChip } from "../../components/ui";

interface RosterMember {
  userId: string;
  username: string;
  displayName: string;
  role: "captain" | "member";
}

interface TeamRoster {
  id: string;
  name: string;
  members: RosterMember[];
}

export function AdminTeams() {
  const { activeTournamentId } = useAuth();
  const [teams, setTeams] = useState<TeamRoster[]>([]);
  const [newTeam, setNewTeam] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const t = await api<{ teams: TeamRoster[] }>("/admin/teams");
      setTeams(t.teams);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }

  // Reload the roster whenever the active tournament changes — everything below
  // is scoped to it (US28).
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTournamentId]);

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
  }

  return (
    <>
      {error && <Alert tone="error">{error}</Alert>}

      <Card className="mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="New team name"
            value={newTeam}
            onChange={(e) => setNewTeam(e.target.value)}
            className="w-64"
          />
          <Button
            icon="plus"
            disabled={!newTeam.trim()}
            onClick={() =>
              run(async () => {
                await api("/admin/teams", { method: "POST", body: JSON.stringify({ name: newTeam }) });
                setNewTeam("");
              })
            }
          >
            Create team
          </Button>
          <Button
            variant="secondary"
            icon="dice"
            onClick={() => run(() => api("/admin/teams/auto-balance", { method: "POST" }))}
          >
            Auto-balance players
          </Button>
        </div>
      </Card>

      {teams.length === 0 ? (
        <EmptyState icon="users" title="No teams yet" hint="Create a team above to get started." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {teams.map((team) => (
            <Card
              key={team.id}
              title={<TeamChip name={team.name} bold />}
              subtitle={`${team.members.length} players`}
              action={
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    if (window.confirm(`Remove team "${team.name}"? Its players will be unassigned.`)) {
                      run(() => api(`/admin/teams/${team.id}`, { method: "DELETE" }));
                    }
                  }}
                >
                  Remove
                </Button>
              }
            >
              <ul className="space-y-2">
                {team.members.map((m) => (
                  <li key={m.userId} className="flex items-center gap-2">
                    <Avatar name={m.displayName} size={26} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold">{m.displayName}</span>
                        {m.role === "captain" && (
                          <Pill tone="brand" icon="flag">
                            Captain
                          </Pill>
                        )}
                      </div>
                      <div className="text-xs text-ink-muted">@{m.username}</div>
                    </div>
                    {m.role !== "captain" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          run(() =>
                            api(`/admin/teams/${team.id}/captain`, {
                              method: "POST",
                              body: JSON.stringify({ userId: m.userId }),
                            }),
                          )
                        }
                      >
                        Make captain
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        run(() => api(`/admin/teams/${team.id}/members/${m.userId}`, { method: "DELETE" }))
                      }
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
