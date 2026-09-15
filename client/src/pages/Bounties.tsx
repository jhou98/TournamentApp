import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { BountyView } from "../lib/types";
import { Icon } from "../components/Icon";
import { Alert, Card, EmptyState, Loading, PageHeader, Pill, TeamChip } from "../components/ui";

/** Active bounties for the tournament, visible to every signed-in player (US16). */
export function Bounties() {
  const [bounties, setBounties] = useState<BountyView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ bounties: BountyView[] }>("/bounties")
      .then((d) => setBounties(d.bounties))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  return (
    <>
      <PageHeader title="Bounties" subtitle="Earn bonus coins by pulling these off" />

      {error && <Alert tone="error">{error}</Alert>}
      {!bounties && !error && <Loading />}

      {bounties && bounties.length === 0 && (
        <EmptyState icon="flag" title="No active bounties" hint="Check back — the admin can add bounties any time." />
      )}

      {bounties && bounties.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {bounties.map((b) => (
            <Card key={b.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-semibold">
                    {b.description}
                    {b.open && <Pill tone="brand">Open</Pill>}
                  </div>
                  <div className="mt-1 text-sm text-ink-muted">
                    {b.open ? (
                      <>First {b.targetType === "team" ? "team" : "player"} to complete it wins</>
                    ) : (
                      <>
                        {b.targetType === "team" ? "Team: " : "Player: "}
                        {b.targetName ? (
                          b.targetType === "team" ? (
                            <TeamChip name={b.targetName} size={18} />
                          ) : (
                            <span className="font-medium text-ink">{b.targetName}</span>
                          )
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 font-bold tabular-nums text-brand">
                  <Icon name="coins" size={16} />
                  {b.coinValue}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
