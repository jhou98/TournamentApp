import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

interface MyMatchup {
  id: string;
  roundIndex: number | null;
  stage: string;
  status: string;
  teamAName: string;
  teamBName: string;
  myTeamId: string | null;
}

interface PlayerView {
  id: string;
  displayName: string;
}
interface PairView {
  slot: number;
  players: PlayerView[];
}
interface TeamSideView {
  id: string;
  name: string;
  roster: PlayerView[];
  locked: boolean;
  pairs: PairView[] | null;
}
interface RevealedGameView {
  id: string;
  roundNo: number;
  courtLabel: string | null;
  status: string;
  homePlayers: PlayerView[];
  awayPlayers: PlayerView[];
}
interface RoundView {
  roundNo: number;
  revealed: boolean;
  teamA: TeamSideView;
  teamB: TeamSideView;
  games: RevealedGameView[];
}
interface LineupContext {
  matchupId: string;
  stage: string;
  status: string;
  roundsPerMatchup: number;
  pairsPerLineup: number;
  pairSize: number;
  isAdmin: boolean;
  myTeamId: string | null;
  teamA: { id: string; name: string };
  teamB: { id: string; name: string };
  rounds: RoundView[];
  pastPairings: PairView[];
}

type Draft = Record<string, string[][]>; // key `${teamId}:${roundNo}` -> pairs of playerIds

const keyOf = (teamId: string, roundNo: number) => `${teamId}:${roundNo}`;

export function Lineups() {
  const { profile } = useAuth();
  const [matchups, setMatchups] = useState<MyMatchup[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [ctx, setCtx] = useState<LineupContext | null>(null);
  const [drafts, setDrafts] = useState<Draft>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    api<{ matchups: MyMatchup[] }>("/matchups")
      .then((r) => {
        setMatchups(r.matchups);
        if (r.matchups.length > 0) setSelected((s) => s ?? r.matchups[0]!.id);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load matchups"));
  }, []);

  async function loadContext(id: string) {
    setError(null);
    try {
      const c = await api<LineupContext>(`/matchups/${id}/lineups`);
      setCtx(c);
      seedDrafts(c);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load lineup");
    }
  }

  useEffect(() => {
    if (selected) loadContext(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  function canEdit(teamId: string): boolean {
    return !!ctx && (ctx.isAdmin || ctx.myTeamId === teamId);
  }

  function seedDrafts(c: LineupContext) {
    const next: Draft = {};
    for (const round of c.rounds) {
      for (const side of [round.teamA, round.teamB]) {
        if (!(c.isAdmin || c.myTeamId === side.id)) continue;
        const existing = side.pairs ?? [];
        const pairs: string[][] = [];
        for (let p = 0; p < c.pairsPerLineup; p++) {
          const players = existing[p]?.players.map((pl) => pl.id) ?? [];
          const row: string[] = [];
          for (let s = 0; s < c.pairSize; s++) row.push(players[s] ?? "");
          pairs.push(row);
        }
        next[keyOf(side.id, round.roundNo)] = pairs;
      }
    }
    setDrafts(next);
  }

  async function run(fn: () => Promise<unknown>, ok?: string) {
    setError(null);
    setNotice(null);
    try {
      await fn();
      if (selected) await loadContext(selected);
      if (ok) setNotice(ok);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
  }

  function setCell(teamId: string, roundNo: number, pairIdx: number, slotIdx: number, value: string) {
    const key = keyOf(teamId, roundNo);
    setDrafts((d) => {
      const pairs = (d[key] ?? []).map((row) => [...row]);
      if (pairs[pairIdx]) pairs[pairIdx]![slotIdx] = value;
      return { ...d, [key]: pairs };
    });
  }

  function submit(teamId: string, roundNo: number) {
    const pairs = drafts[keyOf(teamId, roundNo)] ?? [];
    return run(
      () =>
        api(`/matchups/${selected}/lineups`, {
          method: "POST",
          body: JSON.stringify({ teamId, roundNo, pairs }),
        }),
      "Lineup saved.",
    );
  }
  function lock(teamId: string, roundNo: number) {
    // Save the current draft first so "Lock" also commits any pending edits
    // (a no-op when nothing changed) — one click to lock without a prior save.
    const pairs = drafts[keyOf(teamId, roundNo)] ?? [];
    return run(async () => {
      await api(`/matchups/${selected}/lineups`, {
        method: "POST",
        body: JSON.stringify({ teamId, roundNo, pairs }),
      });
      await api(`/matchups/${selected}/lineups/lock`, {
        method: "POST",
        body: JSON.stringify({ teamId, roundNo }),
      });
    }, "Lineup saved & locked.");
  }
  function unlock(teamId: string, roundNo: number) {
    return run(
      () =>
        api(`/matchups/${selected}/lineups/unlock`, {
          method: "POST",
          body: JSON.stringify({ teamId, roundNo }),
        }),
      "Lineup unlocked.",
    );
  }

  return (
    <div style={{ maxWidth: 860, margin: "1.5rem auto" }}>
      <h1>Lineups</h1>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {notice && <p style={{ color: "green" }}>{notice}</p>}

      {matchups.length === 0 && <p>No matchups to manage yet.</p>}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {matchups.map((m) => (
          <button
            key={m.id}
            onClick={() => setSelected(m.id)}
            style={{
              padding: "6px 10px",
              border: "1px solid #ccc",
              borderRadius: 6,
              background: selected === m.id ? "#eef" : "white",
              fontWeight: selected === m.id ? 600 : 400,
            }}
          >
            {m.teamAName} vs {m.teamBName}
            {m.roundIndex ? ` · R${m.roundIndex}` : ""}
          </button>
        ))}
      </div>

      {ctx && (
        <div>
          <h2 style={{ fontSize: 18 }}>
            {ctx.teamA.name} vs {ctx.teamB.name}
          </h2>
          {ctx.pastPairings.length > 0 && (
            <p style={{ fontSize: 13, color: "#666" }}>
              Your past pairings:{" "}
              {ctx.pastPairings.map((p) => p.players.map((pl) => pl.displayName).join(" & ")).join(", ")}
            </p>
          )}

          {ctx.rounds.map((round) => (
            <div key={round.roundNo} style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, margin: "10px 0 4px" }}>Match {round.roundNo}</h3>

              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {[round.teamA, round.teamB].map((side) => (
                  <SidePanel
                    key={side.id}
                    ctx={ctx}
                    side={side}
                    roundNo={round.roundNo}
                    editable={canEdit(side.id)}
                    draft={drafts[keyOf(side.id, round.roundNo)]}
                    onCell={setCell}
                    onSubmit={() => submit(side.id, round.roundNo)}
                    onLock={() => lock(side.id, round.roundNo)}
                    onUnlock={() => unlock(side.id, round.roundNo)}
                  />
                ))}
              </div>

              {round.revealed && (
                <div style={cardStyle}>
                  <strong>Pairings (revealed)</strong>
                  <table style={{ fontSize: 13, marginTop: 6 }}>
                    <tbody>
                      {round.games.map((g, i) => (
                        <tr key={g.id}>
                          <td style={{ paddingRight: 10 }}>Game {i + 1}</td>
                          <td style={{ paddingRight: 10 }}>{g.courtLabel ?? "—"}</td>
                          <td>
                            {g.homePlayers.map((p) => p.displayName).join(" & ")}
                            {" vs "}
                            {g.awayPlayers.map((p) => p.displayName).join(" & ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}

          {!ctx.isAdmin && !ctx.myTeamId && (
            <p style={{ color: "#777" }}>
              You are viewing this matchup. Only each team's captain (or an admin) can edit lineups.
            </p>
          )}
        </div>
      )}

      {profile?.role === "player" && matchups.length === 0 && (
        <p style={{ color: "#777" }}>Lineups are managed by team captains.</p>
      )}
    </div>
  );
}

function SidePanel({
  ctx,
  side,
  roundNo,
  editable,
  draft,
  onCell,
  onSubmit,
  onLock,
  onUnlock,
}: {
  ctx: LineupContext;
  side: TeamSideView;
  roundNo: number;
  editable: boolean;
  draft: string[][] | undefined;
  onCell: (teamId: string, roundNo: number, pairIdx: number, slotIdx: number, value: string) => void;
  onSubmit: () => void;
  onLock: () => void;
  onUnlock: () => void;
}) {
  return (
    <div style={{ ...cardStyle, flex: "1 1 320px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>{side.name}</strong>
        <span style={{ fontSize: 12, color: side.locked ? "green" : "#999" }}>
          {side.locked ? "🔒 locked" : "unlocked"}
        </span>
      </div>

      {editable && !side.locked && draft && (
        <div style={{ marginTop: 8 }}>
          {draft.map((pair, pairIdx) => (
            <div key={pairIdx} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontSize: 12, width: 48 }}>Pair {pairIdx + 1}</span>
              {pair.map((value, slotIdx) => (
                <select
                  key={slotIdx}
                  value={value}
                  onChange={(e) => onCell(side.id, roundNo, pairIdx, slotIdx, e.target.value)}
                  style={{ fontSize: 13 }}
                >
                  <option value="">player…</option>
                  {side.roster.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.displayName}
                    </option>
                  ))}
                </select>
              ))}
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button onClick={onSubmit}>Save</button>
            <button onClick={onLock}>Lock</button>
          </div>
        </div>
      )}

      {editable && side.locked && (
        <div style={{ marginTop: 8 }}>
          <PairList pairs={side.pairs} />
          {ctx.isAdmin && (
            <button style={{ marginTop: 6 }} onClick={onUnlock}>
              Unlock (admin)
            </button>
          )}
        </div>
      )}

      {!editable && (
        <div style={{ marginTop: 8 }}>
          {side.pairs ? (
            <PairList pairs={side.pairs} />
          ) : (
            <p style={{ fontSize: 13, color: "#999" }}>
              {side.locked ? "Locked — hidden until both sides lock." : "Not submitted yet."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function PairList({ pairs }: { pairs: PairView[] | null }) {
  if (!pairs || pairs.length === 0) return <p style={{ fontSize: 13, color: "#999" }}>No pairs.</p>;
  return (
    <ul style={{ margin: "4px 0", fontSize: 13 }}>
      {pairs.map((p) => (
        <li key={p.slot}>{p.players.map((pl) => pl.displayName).join(" & ")}</li>
      ))}
    </ul>
  );
}

const cardStyle = { border: "1px solid #ccc", borderRadius: 6, padding: 10, marginBottom: 8 } as const;
