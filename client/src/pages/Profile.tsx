import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { coinReasonLabel, stageLabel, type CoinTransactionView, type CoinSummaryView } from "../lib/types";
import { Icon } from "../components/Icon";
import { Avatar, Card, Loading, PageHeader, Pill, StatusPill, TeamMark, cx, type PillTone } from "../components/ui";

const ROLE_TONE: Record<string, PillTone> = {
  admin: "brand",
  captain: "info",
  player: "neutral",
};

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  captain: "Captain",
  player: "Player",
};

function CoinRow({ tx }: { tx: CoinTransactionView }) {
  const m = tx.match;
  const title = m ? (m.won ? "Match win" : "Match loss") : coinReasonLabel(tx.reason);
  const detail = m
    ? `${stageLabel(m.stage, m.roundIndex)} · vs ${m.opponentTeamName} · ${m.scoreFor}–${m.scoreAgainst}`
    : tx.note;

  return (
    <li className="flex items-center gap-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{title}</div>
        {detail && <div className="truncate text-xs text-ink-muted">{detail}</div>}
      </div>
      <time className="shrink-0 text-xs text-ink-faint" dateTime={tx.createdAt}>
        {new Date(tx.createdAt).toLocaleDateString()}
      </time>
      <span
        className={cx(
          "w-16 shrink-0 text-right font-bold tabular-nums",
          tx.delta >= 0 ? "text-success-ink" : "text-danger-ink",
        )}
      >
        {tx.delta >= 0 ? `+${tx.delta}` : tx.delta}
      </span>
    </li>
  );
}

export function Profile() {
  const { profile, tournaments, activeTournamentId } = useAuth();
  const [coins, setCoins] = useState<CoinSummaryView | null>(null);
  const [coinsError, setCoinsError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeTournamentId) {
      setCoins(null);
      return;
    }
    let cancelled = false;
    setCoins(null);
    setCoinsError(null);
    api<CoinSummaryView>("/me/coins")
      .then((data) => {
        if (!cancelled) setCoins(data);
      })
      .catch((err) => {
        if (!cancelled) setCoinsError(err instanceof Error ? err.message : "Failed to load coins");
      });
    return () => {
      cancelled = true;
    };
  }, [activeTournamentId]);

  if (!profile) return null;

  const { user, role, team, captain } = profile;
  const activeTournament = tournaments.find((t) => t.id === activeTournamentId) ?? null;

  return (
    <div>
      <PageHeader title="Profile" subtitle="Your account and team" />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Account" className="lg:col-span-2">
          <div className="flex items-center gap-4">
            <Avatar name={user.displayName} size={56} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-lg font-bold">{user.displayName}</div>
              <div className="truncate text-sm text-ink-muted">@{user.username}</div>
            </div>
            <Pill tone={ROLE_TONE[role] ?? "neutral"}>{ROLE_LABEL[role] ?? role}</Pill>
          </div>
          <p className="mt-5 text-xs text-ink-faint">
            Password changes are coming in a later phase. Ask the commissioner if you're locked out.
          </p>
        </Card>

        <Card
          title="Coins"
          className="lg:col-span-2 lg:order-last"
          action={
            <span className="inline-flex items-center gap-1.5 text-lg font-extrabold text-brand">
              <Icon name="coins" size={18} />
              <span className="tabular-nums">{coins ? coins.balance : "—"}</span>
            </span>
          }
        >
          {!activeTournament ? (
            <p className="text-sm text-ink-muted">Join a tournament to start earning coins.</p>
          ) : coinsError ? (
            <p className="text-sm text-danger-ink">{coinsError}</p>
          ) : !coins ? (
            <Loading />
          ) : coins.transactions.length === 0 ? (
            <p className="text-sm text-ink-muted">
              No coins yet. Win matches and ride streaks to start earning in {activeTournament.name}.
            </p>
          ) : (
            <ul className="divide-y divide-line/70">
              {coins.transactions.slice(0, 12).map((tx) => (
                <CoinRow key={tx.id} tx={tx} />
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-5">
        <Card title="My team">
          {team ? (
            <div>
              <div className="flex items-center gap-2">
                <TeamMark name={team.name} />
                <span className="font-bold">{team.name}</span>
              </div>
              <p className="mt-2 text-sm text-ink-muted">
                {captain ? `Captain: ${captain.displayName} (@${captain.username})` : "No captain yet"}
              </p>
              {role === "captain" && (
                <Pill tone="brand" icon="flag" className="mt-3">
                  You're the captain
                </Pill>
              )}
            </div>
          ) : (
            <p className="text-sm text-ink-muted">Not assigned to a team yet. The commissioner assigns rosters.</p>
          )}
        </Card>

        <Card title="Tournament">
          {activeTournament ? (
            <div className="flex items-center gap-3">
              <span className="font-bold">{activeTournament.name}</span>
              <StatusPill status={activeTournament.status} />
            </div>
          ) : (
            <p className="text-sm text-ink-muted">No tournament</p>
          )}
        </Card>
        </div>
      </div>
    </div>
  );
}
