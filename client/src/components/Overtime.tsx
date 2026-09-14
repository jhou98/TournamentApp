import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Button, Input, Pill, Select, TeamChip } from "./ui";
import { Icon } from "./Icon";

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
 * Sudden death (1v1 tiebreaker) for a matchup tied on game wins — round robin or
 * playoffs. Self-contained: fetches its own state and renders nothing unless
 * sudden death is active or already decided. `myTeamId` is the team the viewer
 * captains in this matchup, or null.
 *
 * `mode` splits the flow by page:
 *  - "setup"  (Captain Panel): captains/admin pick representatives; no score entry.
 *  - "scoring" (Results): admin enters (and can edit) the 1v1 result; reps shown read-only.
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
      if (s.result) {
        setScoreA(String(s.result.scoreA));
        setScoreB(String(s.result.scoreB));
      }
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
  // Reps are editable only in "setup" mode (Captain Panel); scoring is Results-only.
  const repEditable = (teamId: string) => mode === "setup" && !sd.result && canPick(teamId);

  return (
    <div className="rounded-card border border-amber/40 bg-amber-soft/60 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Icon name="bolt" size={16} className="text-amber-ink" />
        <span className="font-bold">Sudden death</span>
        {sd.result ? (
          <Pill tone="success">Final</Pill>
        ) : (
          <Pill tone="warning">Tied</Pill>
        )}
      </div>
      <p className="mt-1 text-[13px] text-ink-muted">
        1v1, first to 5, win by 2, capped at 7.{" "}
        {mode === "setup"
          ? "Each captain picks one representative here; the result is entered on the Results page."
          : "Reps are chosen on the Captain Panel; an admin enters the result here."}
      </p>
      {error && <p className="mt-1 text-[13px] text-danger-ink">{error}</p>}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {[sd.teamA, sd.teamB].map((team) => (
          <div key={team.id}>
            <TeamChip name={team.name} bold />
            <div className="mt-1.5">
              {repEditable(team.id) ? (
                <Select
                  className="ctl-sm"
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
                </Select>
              ) : (
                <div className="text-[13px] text-ink-muted">
                  Rep: {team.rep?.displayName ?? "not chosen yet"}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {sd.result && (
        <p className="mt-3 font-bold">
          Result: {sd.result.scoreA}–{sd.result.scoreB} · {sd.result.winnerName} wins
        </p>
      )}

      {mode === "scoring" && isAdmin && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[13px]">{sd.teamA.name}</span>
          <Input
            className="ctl-sm w-16 text-center"
            value={scoreA}
            onChange={(e) => setScoreA(e.target.value)}
            inputMode="numeric"
          />
          <span>–</span>
          <Input
            className="ctl-sm w-16 text-center"
            value={scoreB}
            onChange={(e) => setScoreB(e.target.value)}
            inputMode="numeric"
          />
          <span className="text-[13px]">{sd.teamB.name}</span>
          <Button
            size="sm"
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
            Save
          </Button>
          {!bothReps && (
            <span className="text-xs text-ink-faint">reps needed (set on Captain Panel)</span>
          )}
        </div>
      )}
    </div>
  );
}
