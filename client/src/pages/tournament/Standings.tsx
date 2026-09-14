import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { fmtDiff, type StandingsView } from "../../lib/types";
import { Alert, Card, EmptyState, Loading, Pill, TeamChip, cx } from "../../components/ui";

export function Standings() {
  const { profile } = useAuth();
  const [data, setData] = useState<StandingsView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<StandingsView>("/standings")
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  const myTeamId = profile?.team?.id ?? null;

  return (
    <>
      {error && <Alert tone="error">{error}</Alert>}

      {!data && !error && <Loading />}

      {data && data.rows.length === 0 && <EmptyState icon="chart" title="No teams yet." />}

      {data && data.rows.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Team</th>
                  <th>W-L</th>
                  <th>Games</th>
                  <th>Game diff</th>
                  <th>Pt diff</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.teamId} className={cx(r.teamId === myTeamId && "bg-brand-soft/40")}>
                    <td className="font-bold">{r.rank}</td>
                    <td>
                      <span className="inline-flex items-center gap-2">
                        <TeamChip name={r.teamName} bold />
                        {r.rank <= 4 && <Pill tone="warning">Q</Pill>}
                      </span>
                    </td>
                    <td className="tabular-nums">
                      {r.matchupsWon}–{r.matchupsLost}
                    </td>
                    <td className="tabular-nums">
                      {r.gamesWon}–{r.gamesLost}
                    </td>
                    <td className={cx("tabular-nums", diffClass(r.gameDiff))}>{fmtDiff(r.gameDiff)}</td>
                    <td className={cx("tabular-nums", diffClass(r.pointDiff))}>{fmtDiff(r.pointDiff)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-ink-muted">
            Ranked by wins, then game differential, then point differential. A matchup tied on
            game wins goes to sudden death (1v1) — there are no ties. Rank seeds the playoff
            bracket once pool play ends.
          </p>
        </Card>
      )}
    </>
  );
}

function diffClass(n: number): string {
  if (n > 0) return "text-success-ink";
  if (n < 0) return "text-danger-ink";
  return "text-ink-muted";
}
