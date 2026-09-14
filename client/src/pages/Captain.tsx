import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Overtime } from "../components/Overtime";
import { stageLabel } from "../lib/types";
import {
  Alert,
  Button,
  Card,
  cx,
  EmptyState,
  Pill,
  PageHeader,
  Select,
  SectionLabel,
  StatusPill,
  TeamChip,
  TeamMark,
} from "../components/ui";
import { Icon } from "../components/Icon";

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

type Draft = Record<string, string[][]>; // key `${matchupId}:${teamId}:${roundNo}` -> pairs of playerIds

const keyOf = (matchupId: string, teamId: string, roundNo: number) =>
  `${matchupId}:${teamId}:${roundNo}`;

export function Captain() {
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
    // Merge, don't replace: keep any in-progress edits (keyed by matchup + team +
    // round) so refetching after a save/lock on one side never wipes the other
    // side's unsaved work. Only seed keys we don't already have.
    setDrafts((prev) => {
      const next: Draft = { ...prev };
      for (const round of c.rounds) {
        for (const side of [round.teamA, round.teamB]) {
          if (!(c.isAdmin || c.myTeamId === side.id)) continue;
          const key = keyOf(c.matchupId, side.id, round.roundNo);
          if (next[key]) continue;
          const existing = side.pairs ?? [];
          const pairs: string[][] = [];
          for (let p = 0; p < c.pairsPerLineup; p++) {
            const players = existing[p]?.players.map((pl) => pl.id) ?? [];
            const row: string[] = [];
            for (let s = 0; s < c.pairSize; s++) row.push(players[s] ?? "");
            pairs.push(row);
          }
          next[key] = pairs;
        }
      }
      return next;
    });
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
    if (!selected) return;
    const key = keyOf(selected, teamId, roundNo);
    setDrafts((d) => {
      const pairs = (d[key] ?? []).map((row) => [...row]);
      if (pairs[pairIdx]) pairs[pairIdx]![slotIdx] = value;
      return { ...d, [key]: pairs };
    });
  }

  function submit(teamId: string, roundNo: number) {
    const pairs = drafts[keyOf(selected!, teamId, roundNo)] ?? [];
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
    const pairs = drafts[keyOf(selected!, teamId, roundNo)] ?? [];
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
  function rematch() {
    return run(
      () => api(`/matchups/${selected}/lineups/rematch`, { method: "POST" }),
      "Pairings re-randomized.",
    );
  }

  return (
    <>
      <PageHeader title="Captain Panel" subtitle="Manage your team and set up matchups" />

      {error && <Alert tone="error" onClose={() => setError(null)}>{error}</Alert>}
      {notice && <Alert tone="success" onClose={() => setNotice(null)}>{notice}</Alert>}

      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <Card title="Matchups" bodyClassName="p-2">
          {matchups.length === 0 ? (
            <EmptyState
              icon="users"
              title="No matchups to manage yet"
              hint={profile?.role === "player" ? "Lineups are managed by team captains." : undefined}
            />
          ) : (
            <div className="flex flex-col gap-1">
              {matchups.map((m) => {
                const isSelected = selected === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelected(m.id)}
                    className={cx(
                      "flex flex-col gap-1.5 rounded-ctl border px-3 py-2.5 text-left transition",
                      isSelected ? "border-brand bg-brand-soft" : "border-transparent hover:bg-sand",
                    )}
                  >
                    <div className="flex items-center gap-2 text-sm font-bold">
                      <TeamMark name={m.teamAName} size={20} />
                      <span className="truncate">{m.teamAName}</span>
                      <span className="text-ink-faint font-normal">vs</span>
                      <TeamMark name={m.teamBName} size={20} />
                      <span className="truncate">{m.teamBName}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-ink-muted">{stageLabel(m.stage, m.roundIndex)}</span>
                      <div className="flex items-center gap-1.5">
                        {m.myTeamId && (
                          <Pill tone="brand" className="text-[10px]">
                            Your team
                          </Pill>
                        )}
                        <StatusPill status={m.status} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        {ctx && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-base">
                <TeamChip name={ctx.teamA.name} bold />
                <span className="text-ink-faint text-sm font-normal">vs</span>
                <TeamChip name={ctx.teamB.name} bold />
              </div>
              {ctx.isAdmin && ctx.rounds.some((r) => r.revealed) && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon="dice"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Re-randomize all pairings for this matchup? Only do this before games are scored.",
                      )
                    ) {
                      rematch();
                    }
                  }}
                >
                  Re-randomize
                </Button>
              )}
            </div>

            {ctx.pastPairings.length > 0 && (
              <div>
                <SectionLabel>Past pairings</SectionLabel>
                <div className="flex flex-wrap gap-1.5">
                  {ctx.pastPairings.map((p, i) => (
                    <Pill key={i} tone="neutral">
                      {p.players.map((pl) => pl.displayName).join(" & ")}
                    </Pill>
                  ))}
                </div>
              </div>
            )}

            {ctx.rounds.map((round) => (
              <Card key={round.roundNo} title={`Match ${round.roundNo}`}>
                <div className="grid gap-4 md:grid-cols-2">
                  {[round.teamA, round.teamB].map((side) => (
                    <SidePanel
                      key={side.id}
                      ctx={ctx}
                      side={side}
                      roundNo={round.roundNo}
                      editable={canEdit(side.id)}
                      draft={drafts[keyOf(ctx.matchupId, side.id, round.roundNo)]}
                      onCell={setCell}
                      onSubmit={() => submit(side.id, round.roundNo)}
                      onLock={() => lock(side.id, round.roundNo)}
                      onUnlock={() => unlock(side.id, round.roundNo)}
                    />
                  ))}
                </div>

                {round.revealed && (
                  <div className="mt-4 rounded-ctl bg-sand/50 p-3">
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-muted">
                      <Icon name="bolt" size={13} />
                      Pairings revealed
                    </div>
                    <div className="overflow-x-auto">
                      <table className="tbl">
                        <thead>
                          <tr>
                            <th>Game</th>
                            <th>Court</th>
                            <th>Matchup</th>
                          </tr>
                        </thead>
                        <tbody>
                          {round.games.map((g, i) => (
                            <tr key={g.id}>
                              <td>Game {i + 1}</td>
                              <td>
                                <Pill tone="neutral">{g.courtLabel ?? "—"}</Pill>
                              </td>
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
                  </div>
                )}
              </Card>
            ))}

            <Overtime
              matchupId={ctx.matchupId}
              mode="setup"
              isAdmin={ctx.isAdmin}
              myTeamId={ctx.myTeamId}
              onResolved={() => selected && loadContext(selected)}
            />

            {!ctx.isAdmin && !ctx.myTeamId && (
              <p className="text-sm text-ink-muted">
                You are viewing this matchup. Only each team's captain (or an admin) can edit lineups.
              </p>
            )}
          </div>
        )}
      </div>
    </>
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
    <div className="rounded-ctl border border-line p-3">
      <div className="flex items-center justify-between gap-2">
        <TeamChip name={side.name} bold size={20} />
        {side.locked ? (
          <Pill tone="success" icon="lock">
            Locked
          </Pill>
        ) : (
          <Pill tone="neutral" icon="unlock">
            Unlocked
          </Pill>
        )}
      </div>

      {editable && !side.locked && draft && (
        <div className="mt-3 flex flex-col gap-2">
          {draft.map((pair, pairIdx) => (
            <div key={pairIdx} className="flex items-center gap-2">
              <span className="w-12 shrink-0 text-xs text-ink-muted">Pair {pairIdx + 1}</span>
              {pair.map((value, slotIdx) => (
                <Select
                  key={slotIdx}
                  className="ctl-sm"
                  value={value}
                  onChange={(e) => onCell(side.id, roundNo, pairIdx, slotIdx, e.target.value)}
                >
                  <option value="">player…</option>
                  {side.roster.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.displayName}
                    </option>
                  ))}
                </Select>
              ))}
            </div>
          ))}
          <div className="mt-1 flex gap-2">
            <Button size="sm" variant="secondary" onClick={onSubmit}>
              Save
            </Button>
            <Button size="sm" icon="lock" onClick={onLock}>
              Lock
            </Button>
          </div>
        </div>
      )}

      {editable && side.locked && (
        <div className="mt-3">
          <PairList pairs={side.pairs} />
          {ctx.isAdmin && (
            <Button size="sm" variant="ghost" icon="unlock" className="mt-2" onClick={onUnlock}>
              Unlock
            </Button>
          )}
        </div>
      )}

      {!editable && (
        <div className="mt-3">
          {side.pairs ? (
            <PairList pairs={side.pairs} />
          ) : (
            <p className="text-[13px] text-ink-faint">
              {side.locked ? "Locked — hidden until both sides lock." : "Not submitted yet."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function PairList({ pairs }: { pairs: PairView[] | null }) {
  if (!pairs || pairs.length === 0) return <p className="text-[13px] text-ink-faint">No pairs.</p>;
  return (
    <ul className="flex flex-col gap-1 text-[13px]">
      {pairs.map((p) => (
        <li key={p.slot} className="flex items-center gap-1.5">
          <span className="text-ink-faint">#{p.slot}</span>
          {p.players.map((pl) => pl.displayName).join(" & ")}
        </li>
      ))}
    </ul>
  );
}
