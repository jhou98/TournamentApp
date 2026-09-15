import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { LeaderboardView } from "../lib/types";
import { Icon } from "../components/Icon";
import { Alert, Card, EmptyState, Loading, PageHeader, TeamChip, cx } from "../components/ui";

const MEDAL = ["text-[#d4a017]", "text-[#8a8f98]", "text-[#b06a3b]"]; // gold / silver / bronze for ranks 1–3

export function Leaderboard() {
  const { profile } = useAuth();
  const [data, setData] = useState<LeaderboardView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<LeaderboardView>("/leaderboard")
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  const meId = profile?.user.id ?? null;

  return (
    <>
      <PageHeader title="Leaderboard" subtitle="Coin standings for this tournament" />

      {error && <Alert tone="error">{error}</Alert>}

      {!data && !error && <Loading />}

      {data && data.rows.length === 0 && (
        <EmptyState icon="coins" title="No players yet." hint="Coins appear here once the roster is set and matches are played." />
      )}

      {data && data.rows.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Player</th>
                  <th>Team</th>
                  <th className="text-right">Coins</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.userId} className={cx(r.userId === meId && "bg-brand-soft/40")}>
                    <td className={cx("font-bold tabular-nums", r.rank <= 3 && MEDAL[r.rank - 1])}>{r.rank}</td>
                    <td className="font-semibold">
                      {r.displayName}
                      {r.userId === meId && <span className="ml-1.5 text-xs font-normal text-ink-muted">(you)</span>}
                    </td>
                    <td>{r.teamName ? <TeamChip name={r.teamName} /> : <span className="text-ink-faint">—</span>}</td>
                    <td className="text-right">
                      <span className="inline-flex items-center gap-1.5 font-bold tabular-nums text-brand">
                        <Icon name="coins" size={15} />
                        {r.balance}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-ink-muted">
            Coins are earned per match and through streak bonuses, and are scoped to this tournament —
            everyone starts at 0. Ties share a rank.
          </p>
        </Card>
      )}
    </>
  );
}
