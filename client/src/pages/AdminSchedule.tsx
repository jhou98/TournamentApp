import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { ScheduleView } from "./Schedule";

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

export function AdminSchedule() {
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
    return (
      <section>
        <h2>Schedule</h2>
        {error && <p style={{ color: "crimson" }}>{error}</p>}
      </section>
    );
  }

  const isSetup = config.status === "setup";

  return (
    <section style={{ marginTop: 32 }}>
      <h2>Schedule &amp; courts</h2>
      <p style={{ margin: "4px 0", color: "#555" }}>
        Status: <strong>{config.status}</strong>
      </p>
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {/* --- Config -------------------------------------------------------- */}
      <div style={cardStyle}>
        <strong>Tournament config</strong>
        {!isSetup && (
          <p style={{ margin: "4px 0", fontSize: 13, color: "#777" }}>
            Config is locked once the schedule is generated. Reset to edit.
          </p>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, margin: "8px 0" }}>
          {CONFIG_FIELDS.map((f) => (
            <label key={f.key} style={{ fontSize: 13 }}>
              <div>{f.label}</div>
              <input
                type="number"
                min={1}
                value={draft[f.key]}
                disabled={!isSetup}
                style={{ width: 90 }}
                onChange={(e) => setDraft({ ...draft, [f.key]: Number(e.target.value) })}
              />
            </label>
          ))}
        </div>
        {isSetup && (
          <button onClick={() => run(() => api("/admin/tournament/config", { method: "PATCH", body: JSON.stringify(draft) }))}>
            Save config
          </button>
        )}
      </div>

      {/* --- Generate / reset / seed playoffs ----------------------------- */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {isSetup ? (
          <button onClick={() => run(() => api("/admin/schedule/generate", { method: "POST" }))}>
            Generate schedule
          </button>
        ) : (
          <button onClick={() => run(() => api("/admin/schedule/reset", { method: "POST" }))}>
            Reset schedule
          </button>
        )}
        {config.status === "round_robin" && (
          <button
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
          </button>
        )}
      </div>
      {config.status === "playoffs" && (
        <p style={{ fontSize: 13, color: "#555", marginBottom: 12 }}>
          Playoffs are underway — manage lineups and enter scores from the Lineups and Results pages.
          The final is created automatically once both semifinals finish.
        </p>
      )}
      {config.status === "completed" && (
        <p style={{ fontSize: 13, color: "#555", marginBottom: 12 }}>🏆 Tournament complete.</p>
      )}

      {/* --- Courts -------------------------------------------------------- */}
      {schedule && schedule.courts.length > 0 && (
        <div style={cardStyle}>
          <strong>Courts</strong>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {schedule.courts.map((court) => (
              <input
                key={court.id}
                defaultValue={court.label}
                style={{ width: 110 }}
                onBlur={(e) => {
                  const label = e.target.value.trim();
                  if (label && label !== court.label) {
                    run(() => api(`/admin/courts/${court.id}`, { method: "PATCH", body: JSON.stringify({ label }) }));
                  }
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* --- Rounds / matchups / games ------------------------------------ */}
      {schedule?.rounds.length === 0 && <p>No schedule yet — generate one above.</p>}
      {schedule?.rounds.map((round) => (
        <div key={round.roundIndex} style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, margin: "8px 0" }}>Round {round.roundIndex}</h3>
          {round.matchups.map((m) => (
            <div key={m.id} style={cardStyle}>
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
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
                <span>vs</span>
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
              <table style={{ fontSize: 13 }}>
                <tbody>
                  {m.games.map((g, i) => (
                    <tr key={g.id}>
                      <td style={{ paddingRight: 8 }}>
                        Match {g.roundNo} · game {i + 1}
                      </td>
                      <td>
                        <select
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
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      ))}
    </section>
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
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {teams.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>
  );
}

const cardStyle = { border: "1px solid #ccc", borderRadius: 6, padding: 10, marginBottom: 8 } as const;
