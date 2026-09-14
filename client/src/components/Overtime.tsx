import { useEffect, useState } from "react";
import { api } from "../lib/api";

interface Player {
  id: string;
  displayName: string;
}
interface SDTeam {
  id: string;
  name: string;
  rep: Player | null;
  eligible: Player[];
}
export interface OvertimeState {
  active: boolean;
  teamA: SDTeam;
  teamB: SDTeam;
  result: { scoreA: number; scoreB: number; winnerTeamId: string; winnerName: string } | null;
}

/**
 * Overtime (1v1 tiebreaker) for a tied playoff matchup. Self-contained: fetches
 * its own state and renders nothing unless overtime is active or already decided.
 * `myTeamId` is the team the viewer captains in this matchup, or null.
 *
 * `mode` splits the flow by page:
 *  - "setup"  (Lineups): captains/admin pick representatives; no score entry.
 *  - "scoring" (Results): admin enters the 1v1 result; reps shown read-only.
 */
export function Overtime({
  matchupId,
  mode,
  isAdmin,
  myTeamId,
  onResolved,
}: {
  matchupId: string;
  mode: "setup" | "scoring";
  isAdmin: boolean;
  myTeamId: string | null;
  onResolved?: () => void;
}) {
  const [sd, setSd] = useState<OvertimeState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");

  async function load() {
    try {
      const s = await api<OvertimeState>(`/matchups/${matchupId}/sudden-death`);
      setSd(s.active || s.result ? s : null);
    } catch {
      setSd(null);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchupId]);

  async function act(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      await load();
      onResolved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
  }

  if (!sd) return null;

  const canPick = (teamId: string) => isAdmin || myTeamId === teamId;
  const bothReps = !!sd.teamA.rep && !!sd.teamB.rep;
  // Reps are editable only in "setup" mode (Lineups); scoring is Results-only.
  const repEditable = (teamId: string) => mode === "setup" && !sd.result && canPick(teamId);

  return (
    <div style={panel}>
      <strong>⚡ Overtime{sd.result ? " — final" : " — tied"}</strong>
      <p style={{ fontSize: 13, color: "#666", margin: "4px 0" }}>
        1v1, first to 5, win by 2, capped at 7.{" "}
        {mode === "setup"
          ? "Each captain picks one representative here; the result is entered on the Results page."
          : "Reps are chosen on the Lineups page; an admin enters the result here."}
      </p>
      {error && <p style={{ color: "crimson", fontSize: 13 }}>{error}</p>}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {[sd.teamA, sd.teamB].map((team) => (
          <div key={team.id} style={{ flex: "1 1 260px" }}>
            <div style={{ fontWeight: 600 }}>{team.name}</div>
            {repEditable(team.id) ? (
              <select
                value={team.rep?.id ?? ""}
                onChange={(e) =>
                  act(() =>
                    api(`/matchups/${matchupId}/sudden-death/rep`, {
                      method: "POST",
                      body: JSON.stringify({ teamId: team.id, userId: e.target.value }),
                    }),
                  )
                }
              >
                <option value="">choose rep…</option>
                {team.eligible.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayName}
                  </option>
                ))}
              </select>
            ) : (
              <div style={{ fontSize: 14, color: team.rep ? "#333" : "#999" }}>
                Rep: {team.rep?.displayName ?? "not chosen yet"}
              </div>
            )}
          </div>
        ))}
      </div>

      {sd.result ? (
        <p style={{ marginTop: 10, fontWeight: 600 }}>
          Result: {sd.result.scoreA}–{sd.result.scoreB} · {sd.result.winnerName} advances 🏸
        </p>
      ) : (
        mode === "scoring" &&
        isAdmin && (
          <div style={{ marginTop: 10, display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 13 }}>{sd.teamA.name}</span>
            <input value={scoreA} onChange={(e) => setScoreA(e.target.value)} style={num} inputMode="numeric" />
            <span>–</span>
            <input value={scoreB} onChange={(e) => setScoreB(e.target.value)} style={num} inputMode="numeric" />
            <span style={{ fontSize: 13 }}>{sd.teamB.name}</span>
            <button
              disabled={!bothReps || scoreA === "" || scoreB === ""}
              onClick={() =>
                act(() =>
                  api(`/admin/matchups/${matchupId}/sudden-death`, {
                    method: "POST",
                    body: JSON.stringify({ scoreA: Number(scoreA), scoreB: Number(scoreB) }),
                  }),
                )
              }
            >
              Record overtime result
            </button>
            {!bothReps && <span style={{ fontSize: 12, color: "#999" }}>reps needed (set on Lineups)</span>}
          </div>
        )
      )}
    </div>
  );
}

const panel = {
  border: "1px solid #c0392b",
  background: "#fff7f6",
  borderRadius: 6,
  padding: 10,
  marginTop: 12,
} as const;
const num = { width: 44, fontSize: 13, textAlign: "center" as const, padding: "2px 4px" };
