import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type {
  CoinSummaryView,
  ResultMatchupView,
  ResultsView,
  ScheduleMatchupView,
  ScheduleView,
  StandingsView,
} from "../lib/types";
import { stageLabel } from "../lib/types";
import { Icon, Shuttle } from "../components/Icon";
import { Alert, Button, Card, EmptyState, Loading, PageHeader, Pill, StatCard, TeamChip, TeamMark } from "../components/ui";

/** Home dashboard: live banner, headline stats, recent results, my team. */
export function Home() {
  const { profile, tournaments, activeTournamentId } = useAuth();
  const [schedule, setSchedule] = useState<ScheduleView | null>(null);
  const [standings, setStandings] = useState<StandingsView | null>(null);
  const [results, setResults] = useState<ResultsView | null>(null);
  const [coins, setCoins] = useState<CoinSummaryView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeTournamentId) return;
    Promise.all([api<ScheduleView>("/schedule"), api<StandingsView>("/standings"), api<ResultsView>("/results")])
      .then(([s, st, r]) => {
        setSchedule(s);
        setStandings(st);
        setResults(r);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
    // Coins load independently so an economy hiccup never blanks the dashboard.
    api<CoinSummaryView>("/me/coins")
      .then(setCoins)
      .catch(() => setCoins(null));
  }, [activeTournamentId]);

  if (!profile) return null;
  const tournament = tournaments.find((t) => t.id === activeTournamentId) ?? null;

  if (!tournament) {
    return (
      <>
        <PageHeader title={`Welcome, ${profile.user.displayName}`} subtitle="You're not part of a tournament yet." />
        <EmptyState
          icon="trophy"
          title="No tournament yet"
          hint={
            profile.role === "admin"
              ? "Create a tournament from the Admin Panel to get started."
              : "Ask the commissioner to add you to a team."
          }
          action={
            profile.role === "admin" ? (
              <Link to="/admin/tournaments">
                <Button icon="plus">Create tournament</Button>
              </Link>
            ) : undefined
          }
        />
      </>
    );
  }

  const status = tournament.status;
  const myTeamId = profile.team?.id ?? null;

  // --- derived numbers -------------------------------------------------
  const allMatchups: ScheduleMatchupView[] = schedule?.rounds.flatMap((r) => r.matchups) ?? [];
  const gamesPlayed = results?.matchups.reduce(
    (n, m) => n + m.matches.reduce((k, match) => k + match.games.filter((g) => g.status === "final").length, 0),
    0,
  );
  const gamesTotal = allMatchups.reduce((n, m) => n + m.games.length, 0);
  const upcomingMine = allMatchups.filter(
    (m) => m.status !== "final" && (!myTeamId || m.teamAId === myTeamId || m.teamBId === myTeamId),
  );
  const nextMatchup = upcomingMine[0] ?? allMatchups.find((m) => m.status !== "final") ?? null;
  const recent = (results?.matchups ?? []).filter((m) => m.status === "final").slice(-4).reverse();
  const champion = results?.matchups.find((m) => m.stage === "final" && m.winnerTeamName)?.winnerTeamName ?? null;
  const myRow = standings?.rows.find((r) => r.teamId === myTeamId) ?? null;

  const banner = {
    setup: {
      title: "Getting things ready",
      body: "Teams and the schedule are still being set up. Check back once the commissioner kicks things off.",
    },
    round_robin: {
      title: "The Tournament is Live!",
      body: "Check scores, results and standings in real time. Let's see who takes the crown!",
    },
    playoffs: {
      title: "Playoffs are on!",
      body: "Semifinals and the final. Most game wins advances; a 3–3 goes to a 1v1 overtime.",
    },
    completed: {
      title: champion ? `${champion} take the crown!` : "Tournament complete",
      body: "Thanks for playing. Full results and final standings are in the Tournament Tracker.",
    },
  }[status];

  return (
    <>
      <PageHeader title={tournament.name} subtitle="Play · Compete · Celebrate" />

      {error && <Alert tone="error">{error}</Alert>}

      {/* hero banner */}
      <section className="hero-warm relative mb-5 overflow-hidden rounded-card border border-line p-6 sm:p-7">
        <div className="relative z-10 max-w-lg">
          <h2 className="text-2xl font-extrabold sm:text-[26px]">{banner.title}</h2>
          <p className="mt-2 text-sm text-ink-muted">{banner.body}</p>
          <Link to="/tournament" className="mt-4 inline-block">
            <Button icon="trophy">View Tournament Tracker</Button>
          </Link>
        </div>
        <Shuttle size={150} className="pointer-events-none absolute -right-4 -top-4 hidden rotate-12 opacity-90 sm:block" />
      </section>

      {/* stats */}
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard icon="users" label="Total teams" value={standings ? standings.rows.length : "—"} />
        <StatCard
          icon="calendar"
          label="Games played"
          value={results ? gamesPlayed : "—"}
          hint={schedule && gamesTotal > 0 ? `of ${gamesTotal} scheduled` : undefined}
        />
        <StatCard
          icon="clock"
          label={myTeamId ? "Your next matchup" : "Next matchup"}
          value={nextMatchup ? `${nextMatchup.teamAName} vs ${nextMatchup.teamBName}` : status === "completed" ? "All done" : "—"}
          hint={nextMatchup ? stageLabel(nextMatchup.stage, nextMatchup.roundIndex) : undefined}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* recent results */}
        <Card
          className="lg:col-span-2"
          title="Recent results"
          action={
            <Link to="/tournament/results" className="link text-[13px]">
              View all
            </Link>
          }
        >
          {!results ? (
            <Loading />
          ) : recent.length === 0 ? (
            <EmptyState icon="trophy" title="No results yet" hint="Scores show up here as soon as the commissioner enters them." />
          ) : (
            <ul className="divide-y divide-line/70">
              {recent.map((m) => (
                <ResultRow key={m.id} m={m} />
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-5">
          {/* my coins */}
          <Card
            title="My coins"
            action={
              <Link to="/profile" className="link text-[13px]">
                History
              </Link>
            }
          >
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-ctl bg-brand-soft text-brand">
                <Icon name="coins" size={22} />
              </span>
              <div>
                <div className="text-2xl font-extrabold tabular-nums text-brand">
                  {coins ? coins.balance : "—"}
                </div>
                <div className="text-xs text-ink-muted">Earned in {tournament.name}</div>
              </div>
            </div>
          </Card>

          {/* my team */}
          <Card title="My team">
            {profile.team ? (
              <div>
                <div className="flex items-center gap-3">
                  <TeamMark name={profile.team.name} size={40} />
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-bold">{profile.team.name}</div>
                    <div className="text-xs text-ink-muted">
                      Captain:{" "}
                      {profile.captain ? (
                        <span className="font-semibold text-ink">{profile.captain.displayName}</span>
                      ) : (
                        "not assigned"
                      )}
                    </div>
                  </div>
                </div>
                {myRow && (
                  <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <Stat label="Rank" value={`#${myRow.rank}`} />
                    <Stat label="W-L" value={`${myRow.matchupsWon}-${myRow.matchupsLost}`} />
                    <Stat label="Games" value={`${myRow.gamesWon}-${myRow.gamesLost}`} />
                  </dl>
                )}
                {profile.role === "captain" && (
                  <Link to="/captain" className="mt-4 block">
                    <Button variant="secondary" size="sm" icon="users" className="w-full">
                      Open Captain Panel
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <p className="text-sm text-ink-muted">You're not on a team yet. The commissioner assigns rosters.</p>
            )}
          </Card>

          {/* standings snapshot */}
          <Card
            title="Standings"
            action={
              <Link to="/tournament/standings" className="link text-[13px]">
                Full table
              </Link>
            }
          >
            {!standings ? (
              <Loading />
            ) : standings.rows.length === 0 ? (
              <p className="text-sm text-ink-muted">No teams yet.</p>
            ) : (
              <ol className="space-y-2">
                {standings.rows.slice(0, 4).map((r) => (
                  <li key={r.teamId} className="flex items-center gap-2 text-sm">
                    <span className="w-5 text-xs font-bold text-ink-faint">{r.rank}</span>
                    <span className={r.teamId === myTeamId ? "font-bold" : ""}>
                      <TeamChip name={r.teamName} size={22} />
                    </span>
                    <span className="ml-auto tabular-nums text-ink-muted">
                      {r.matchupsWon}-{r.matchupsLost}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-ctl bg-sand px-2 py-2">
      <dt className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">{label}</dt>
      <dd className="text-base font-extrabold">{value}</dd>
    </div>
  );
}

function ResultRow({ m }: { m: ResultMatchupView }) {
  const aWon = m.winnerTeamId === m.teamAId;
  const bWon = m.winnerTeamId === m.teamBId;
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className={`min-w-0 flex-1 ${aWon ? "font-bold" : ""}`}>
        <TeamChip name={m.teamAName} />
      </span>
      <span className="shrink-0 rounded-ctl bg-sand px-2.5 py-1 text-sm font-extrabold tabular-nums text-brand">
        {m.matchupScore.teamA} – {m.matchupScore.teamB}
      </span>
      <span className={`min-w-0 flex-1 ${bWon ? "font-bold" : ""}`}>
        <TeamChip name={m.teamBName} />
      </span>
      <span className="hidden shrink-0 items-center gap-2 sm:flex">
        <span className="text-xs text-ink-faint">{stageLabel(m.stage, m.roundIndex)}</span>
        <Pill tone="success" icon="check">Completed</Pill>
      </span>
      <Link to="/tournament/results" className="text-ink-faint hover:text-ink" aria-label="Open results">
        <Icon name="chevronRight" size={16} />
      </Link>
    </li>
  );
}
