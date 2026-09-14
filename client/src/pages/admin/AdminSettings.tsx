import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { orderRounds, type ScheduleView } from "../../lib/types";
import { Alert, Button, Card, EmptyState, Field, Input, Select, StatusPill } from "../../components/ui";

interface TournamentConfig {
  id: string;
  name: string;
  status: string;
  teamCount: number;
  teamSize: number;
  pairSize: number;
  pairsPerLineup: number;
  roundsPerMatchup: number;
  roundRobinCycles: number;
  playoffQualifiers: number;
  courtCount: number;
}

type ConfigKey =
  | "teamCount"
  | "teamSize"
  | "pairSize"
  | "pairsPerLineup"
  | "roundsPerMatchup"
  | "roundRobinCycles"
  | "playoffQualifiers"
  | "courtCount";

const CONFIG_FIELDS: { key: ConfigKey; label: string }[] = [
  { key: "teamCount", label: "Teams" },
  { key: "teamSize", label: "Players / team" },
  { key: "pairSize", label: "Players / pair" },
  { key: "pairsPerLineup", label: "Pairs / match" },
  { key: "roundsPerMatchup", label: "Matches / matchup" },
  { key: "roundRobinCycles", label: "Round-robin cycles" },
  { key: "playoffQualifiers", label: "Playoff qualifiers" },
  { key: "courtCount", label: "Courts" },
];

interface TeamRef {
  id: string;
  name: string;
}

export function AdminSettings() {
  const [config, setConfig] = useState<TournamentConfig | null>(null);
  const [draft, setDraft] = useState<Record<ConfigKey, number> | null>(null);
  const [schedule, setSchedule] = useState<ScheduleView | null>(null);
  const [teams, setTeams] = useState<TeamRef[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const [c, s, t] = await Promise.all([
        api<{ config: TournamentConfig }>("/admin/tournament/config"),
        api<ScheduleView>("/schedule"),
        api<{ teams: TeamRef[] }>("/admin/teams"),
      ]);
      setConfig(c.config);
      setDraft(Object.fromEntries(CONFIG_FIELDS.map((f) => [f.key, c.config[f.key]])) as Record<ConfigKey, number>);
      setSchedule(s);
      setTeams(t.teams);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
  }

  if (!config || !draft) {
    return error ? <Alert tone="error">{error}</Alert> : null;
  }

  const isSetup = config.status === "setup";

  return (
    <>
      {error && <Alert tone="error">{error}</Alert>}

      {/* --- Config -------------------------------------------------------- */}
      <Card
        title="Tournament config"
        subtitle={!isSetup ? "Config is locked once the schedule is generated. Reset to edit." : undefined}
        action={<StatusPill status={config.status} />}
        className="mb-5"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CONFIG_FIELDS.map((f) => (
            <Field key={f.key} label={f.label}>
              <Input
                type="number"
                min={1}
                value={draft[f.key]}
                disabled={!isSetup}
                onChange={(e) => setDraft({ ...draft, [f.key]: Number(e.target.value) })}
              />
            </Field>
          ))}
        </div>
        {isSetup ? (
          <Button
            className="mt-4"
            onClick={() => run(() => api("/admin/tournament/config", { method: "PATCH", body: JSON.stringify(draft) }))}
          >
            Save config
          </Button>
        ) : (
          <p className="mt-4 text-xs text-ink-muted">Config is locked while the schedule is active.</p>
        )}
      </Card>

      {/* --- Generate / reset / seed playoffs ----------------------------- */}
      <Card title="Schedule" className="mb-5">
        <div className="flex flex-wrap gap-2">
          {isSetup ? (
            <Button onClick={() => run(() => api("/admin/schedule/generate", { method: "POST" }))}>
              Generate schedule
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => run(() => api("/admin/schedule/reset", { method: "POST" }))}>
              Reset schedule
            </Button>
          )}
          {config.status === "round_robin" && (
            <Button
              variant="dark"
              onClick={() => {
                if (
                  window.confirm(
                    "Seed the playoffs from the current standings? Enter every round-robin result first.",
                  )
                ) {
                  run(() => api("/admin/playoffs/seed", { method: "POST" }));
                }
              }}
            >
              Seed playoffs
            </Button>
          )}
        </div>
        {config.status === "playoffs" && (
          <Alert tone="info">
            Playoffs are underway — manage lineups and enter scores from the Captain Panel and Results pages. The final is
            created automatically once both semifinals finish.
          </Alert>
        )}
        {config.status === "completed" && <Alert tone="info">🏆 Tournament complete.</Alert>}
      </Card>

      {/* --- Courts -------------------------------------------------------- */}
      {schedule && schedule.courts.length > 0 && (
        <Card title="Courts" className="mb-5">
          <div className="flex flex-wrap gap-2">
            {schedule.courts.map((court) => (
              <input
                key={court.id}
                defaultValue={court.label}
                className="ctl ctl-sm w-28"
                onBlur={(e) => {
                  const label = e.target.value.trim();
                  if (label && label !== court.label) {
                    run(() => api(`/admin/courts/${court.id}`, { method: "PATCH", body: JSON.stringify({ label }) }));
                  }
                }}
              />
            ))}
          </div>
        </Card>
      )}

      {/* --- Rounds / matchups / games ------------------------------------ */}
      {schedule?.rounds.length === 0 && (
        <EmptyState icon="calendar" title="No schedule yet — generate one above." />
      )}
      {schedule && orderRounds(schedule.rounds).map((round) => (
        <Card key={round.roundIndex} title={round.roundIndex === 0 ? "Playoffs" : `Round ${round.roundIndex}`} className="mb-4">
          <div className="space-y-4">
            {round.matchups.map((m) => (
              <div key={m.id} className="rounded-ctl border border-line p-3">
                <div className="mb-2 flex items-center gap-2">
                  <TeamSelect
                    teams={teams}
                    value={m.teamAId}
                    onChange={(teamAId) =>
                      run(() =>
                        api(`/admin/matchups/${m.id}`, {
                          method: "PATCH",
                          body: JSON.stringify({ teamAId, teamBId: m.teamBId }),
                        }),
                      )
                    }
                  />
                  <span className="text-xs font-bold text-ink-muted">vs</span>
                  <TeamSelect
                    teams={teams}
                    value={m.teamBId}
                    onChange={(teamBId) =>
                      run(() =>
                        api(`/admin/matchups/${m.id}`, {
                          method: "PATCH",
                          body: JSON.stringify({ teamAId: m.teamAId, teamBId }),
                        }),
                      )
                    }
                  />
                </div>
                <table className="tbl">
                  <tbody>
                    {m.games.map((g, i) => (
                      <tr key={g.id}>
                        <td>
                          Match {g.roundNo} · Game {i + 1}
                        </td>
                        <td>
                          <Select
                            className="ctl ctl-sm"
                            value={g.courtId ?? ""}
                            onChange={(e) =>
                              run(() =>
                                api(`/admin/games/${g.id}`, {
                                  method: "PATCH",
                                  body: JSON.stringify({ courtId: e.target.value }),
                                }),
                              )
                            }
                          >
                            <option value="" disabled>
                              court…
                            </option>
                            {schedule.courts.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.label}
                              </option>
                            ))}
                          </Select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </>
  );
}

function TeamSelect({
  teams,
  value,
  onChange,
}: {
  teams: TeamRef[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <Select className="ctl ctl-sm" value={value} onChange={(e) => onChange(e.target.value)}>
      {teams.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </Select>
  );
}
