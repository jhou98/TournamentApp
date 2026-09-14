import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { orderRounds, stageLabel, type ScheduleGameView, type ScheduleMatchupView, type ScheduleView } from "../../lib/types";
import { Alert, Card, EmptyState, Loading, Pill, StatusPill, TeamChip, cx } from "../../components/ui";


export function Schedule() {
  const { profile } = useAuth();
  const [schedule, setSchedule] = useState<ScheduleView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<ScheduleView>("/schedule")
      .then(setSchedule)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  const myTeamId = profile?.team?.id ?? null;

  return (
    <>
      {error && <Alert tone="error">{error}</Alert>}

      {!schedule && !error && <Loading />}

      {schedule && schedule.rounds.length === 0 && (
        <EmptyState icon="calendar" title="The schedule hasn't been generated yet." />
      )}

      {schedule && schedule.rounds.length > 0 && (
        <div className="space-y-5">
          {orderRounds(schedule.rounds).map((round) => (
            <Card key={round.roundIndex} title={round.roundIndex === 0 ? "Playoffs" : `Round ${round.roundIndex}`}>
              <div className="space-y-3">
                {round.matchups.map((m) => (
                  <MatchupRow key={m.id} matchup={m} isPlayoffs={round.roundIndex === 0} myTeamId={myTeamId} />
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function MatchupRow({
  matchup,
  isPlayoffs,
  myTeamId,
}: {
  matchup: ScheduleMatchupView;
  isPlayoffs: boolean;
  myTeamId: string | null;
}) {
  const byRound = new Map<number, ScheduleGameView[]>();
  for (const g of matchup.games) {
    byRound.set(g.roundNo, [...(byRound.get(g.roundNo) ?? []), g]);
  }
  const isMine = myTeamId != null && (matchup.teamAId === myTeamId || matchup.teamBId === myTeamId);

  return (
    <div className={cx("rounded-ctl border border-line p-3", isMine && "bg-brand-soft/40")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {isPlayoffs && <Pill tone="brand">{stageLabel(matchup.stage)}</Pill>}
          <TeamChip name={matchup.teamAName} />
          <span className="text-xs font-bold text-ink-faint">vs</span>
          <TeamChip name={matchup.teamBName} />
          {isMine && <Pill tone="brand">Your team</Pill>}
        </div>
        <StatusPill status={matchup.status} />
      </div>

      {byRound.size > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
          {[...byRound.entries()].map(([roundNo, games]) => (
            <div key={roundNo} className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Match {roundNo}</span>
              {games.map((g) => (
                <Pill key={g.id} tone="neutral">
                  {g.courtLabel ?? "—"}
                </Pill>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
