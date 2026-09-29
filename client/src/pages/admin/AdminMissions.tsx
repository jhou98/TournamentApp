import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import type { MissionView } from "../../lib/types";
import { useToast } from "../../components/Toast";
import { Alert, Button, Card, EmptyState, Field, Input, Pill, Select } from "../../components/ui";

interface RosterMember {
  userId: string;
  displayName: string;
}
interface TeamRoster {
  id: string;
  name: string;
  members: RosterMember[];
}
interface PlayerOption extends RosterMember {
  teamName: string;
}

/**
 * Admin mission assignment (US23, scoped down): write a mission + prize and
 * assign it to one player. Completing it in their Missions page removes it
 * from the player's view and marks it "Completed" here, so the admin knows
 * to award coins (via the Coins tab) and can then remove it.
 */
export function AdminMissions() {
  const { activeTournamentId } = useAuth();
  const { showToast } = useToast();
  const [missions, setMissions] = useState<MissionView[]>([]);
  const [teams, setTeams] = useState<TeamRoster[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [userId, setUserId] = useState("");
  const [description, setDescription] = useState("");
  const [prize, setPrize] = useState("");
  const [busy, setBusy] = useState(false);

  const players: PlayerOption[] = useMemo(
    () => teams.flatMap((t) => t.members.map((m) => ({ ...m, teamName: t.name }))),
    [teams],
  );

  async function load() {
    setError(null);
    try {
      const [m, t] = await Promise.all([
        api<{ missions: MissionView[] }>("/admin/missions"),
        api<{ teams: TeamRoster[] }>("/admin/teams"),
      ]);
      setMissions(m.missions);
      setTeams(t.teams);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTournamentId]);

  const canCreate = userId !== "" && description.trim() !== "" && prize.trim() !== "";

  async function create() {
    if (!canCreate || busy) return;
    setBusy(true);
    try {
      await api("/admin/missions", {
        method: "POST",
        body: JSON.stringify({ userId, description: description.trim(), prize: prize.trim() }),
      });
      showToast("Mission assigned.", "success");
      setUserId("");
      setDescription("");
      setPrize("");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not assign mission", "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove(m: MissionView) {
    if (!window.confirm(`Remove mission "${m.description}" from ${m.playerName}?`)) return;
    try {
      await api(`/admin/missions/${m.id}`, { method: "DELETE" });
      showToast("Mission removed.", "success");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not remove mission", "error");
    }
  }

  return (
    <>
      {error && <Alert tone="error">{error}</Alert>}

      <Card className="mb-5" title="New mission" subtitle="Secretly assign a mission and a prize to one player.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Player">
            <Select value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Select…</option>
              {players.map((p) => (
                <option key={p.userId} value={p.userId}>
                  {p.displayName} · {p.teamName}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Prize">
            <Input placeholder="e.g. 50 coins" value={prize} maxLength={200} onChange={(e) => setPrize(e.target.value)} />
          </Field>

          <Field label="Mission" className="sm:col-span-2">
            <textarea
              className="ctl"
              placeholder="What do they need to do?"
              value={description}
              maxLength={500}
              rows={2}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
        </div>

        <div className="mt-3">
          <Button icon="plus" disabled={!canCreate || busy} onClick={create}>
            Assign mission
          </Button>
        </div>
      </Card>

      {missions.length === 0 ? (
        <EmptyState icon="target" title="No missions yet" hint="Assign one above — only that player (and admins) can see it." />
      ) : (
        <Card title="Assigned missions" subtitle="Only visible to the assigned player and admins.">
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Mission</th>
                  <th>Prize</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {missions.map((m) => (
                  <tr key={m.id}>
                    <td className="font-semibold">{m.playerName}</td>
                    <td className="text-ink-muted">{m.description}</td>
                    <td>{m.prize}</td>
                    <td>
                      {m.completed ? (
                        <Pill tone="success" icon="check">
                          Completed
                        </Pill>
                      ) : (
                        <Pill tone="neutral">Assigned</Pill>
                      )}
                    </td>
                    <td>
                      <div className="flex justify-end">
                        <Button variant="ghost" size="sm" onClick={() => remove(m)}>
                          Remove
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
