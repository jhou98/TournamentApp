import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Overtime } from "../../components/Overtime";
import { stageLabel, type PlayerView, type ResultGameView, type ResultMatchupView, type ResultsView } from "../../lib/types";
import { Alert, Button, Card, EmptyState, Input, Loading, Pill, SectionLabel, TeamChip } from "../../components/ui";
import { Icon } from "../../components/Icon";

const names = (players: PlayerView[]) =>
  players.length ? players.map((p) => p.displayName).join(" & ") : "TBD";

export function Results() {
  const [data, setData] = useState<ResultsView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    try {
      setData(await api<ResultsView>("/results"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function saveScore(gameId: string, scoreHome: number, scoreAway: number) {
    setError(null);
    setNotice(null);
    try {
      await api(`/admin/games/${gameId}`, {
        method: "PATCH",
        body: JSON.stringify({ scoreHome, scoreAway }),
      });
      setNotice("Score saved.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save score");
    }
  }

  const champion = data?.matchups.find((m) => m.stage === "final" && m.winnerTeamName)?.winnerTeamName;
  const grouped: { label: string; stages: string[] }[] = [
    { label: "Round robin", stages: ["round_robin"] },
    { label: "Playoffs", stages: ["semifinal", "final"] },
  ];

  return (
    <>
      {error && (
        <Alert tone="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {notice && (
        <Alert tone="success" onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      {champion && (
        <div className="hero-warm mb-5 flex items-center gap-3 rounded-card border border-line px-5 py-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-soft text-amber-ink">
            <Icon name="trophy" size={22} />
          </div>
          <div className="text-lg font-extrabold">Champion: {champion}</div>
        </div>
      )}

      {!data && !error && <Loading />}

      {data && data.matchups.length === 0 && <EmptyState icon="trophy" title="No matchups yet." />}

      {data &&
        grouped.map((group) => {
          const ms = data.matchups.filter((m) => group.stages.includes(m.stage));
          if (ms.length === 0) return null;
          return (
            <section key={group.label} className="mb-6">
              <SectionLabel>{group.label}</SectionLabel>
              <div className="space-y-4">
                {ms.map((m) => (
                  <MatchupCard key={m.id} matchup={m} canScore={data.isAdmin} onScore={saveScore} onResolved={load} />
                ))}
              </div>
            </section>
          );
        })}
    </>
  );
}

function MatchupCard({
  matchup: m,
  canScore,
  onScore,
  onResolved,
}: {
  matchup: ResultMatchupView;
  canScore: boolean;
  onScore: (gameId: string, h: number, a: number) => void;
  onResolved: () => void;
}) {
  const aWon = m.winnerTeamId === m.teamAId;
  const bWon = m.winnerTeamId === m.teamBId;

  const statusPill = m.winnerTeamName ? (
    <Pill tone="success" icon="check">
      {m.winnerTeamName} wins{m.tied ? " (overtime)" : ""}
    </Pill>
  ) : m.tied ? (
    m.stage === "round_robin" ? (
      <Pill tone="info">Tie</Pill>
    ) : (
      <Pill tone="warning" icon="bolt">
        Overtime
      </Pill>
    )
  ) : m.status === "in_progress" ? (
    <Pill tone="warning">In progress</Pill>
  ) : (
    <Pill tone="neutral">Scheduled</Pill>
  );

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <span className={aWon ? "font-bold" : ""}>
            <TeamChip name={m.teamAName} bold={aWon} />
          </span>
          <span className="shrink-0 rounded-ctl bg-sand px-3 py-1 text-sm font-extrabold tabular-nums text-brand">
            {m.matchupScore.teamA} – {m.matchupScore.teamB}
          </span>
          <span className={bWon ? "font-bold" : ""}>
            <TeamChip name={m.teamBName} bold={bWon} />
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-ink-faint">{stageLabel(m.stage, m.roundIndex)}</span>
          {statusPill}
        </div>
      </div>

      {m.matches.map((match) => (
        <div key={match.roundNo} className="mt-4">
          <div className="mb-1.5 text-xs font-bold uppercase tracking-wider text-ink-muted">
            Match {match.roundNo} · {match.roundScore.teamA}–{match.roundScore.teamB}
          </div>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Game</th>
                  <th>Court</th>
                  <th>Home</th>
                  <th className="text-center">Score</th>
                  <th>Away</th>
                  {canScore && <th />}
                </tr>
              </thead>
              <tbody>
                {match.games.map((g, i) => (
                  <GameRow key={g.id} game={g} index={i} canScore={canScore} onScore={onScore} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {m.stage !== "round_robin" && (
        <Overtime matchupId={m.id} mode="scoring" isAdmin={canScore} myTeamId={null} onResolved={onResolved} />
      )}
    </Card>
  );
}

function GameRow({
  game: g,
  index,
  canScore,
  onScore,
}: {
  game: ResultGameView;
  index: number;
  canScore: boolean;
  onScore: (gameId: string, h: number, a: number) => void;
}) {
  const [home, setHome] = useState<string>(g.scoreHome?.toString() ?? "");
  const [away, setAway] = useState<string>(g.scoreAway?.toString() ?? "");
  const assigned = g.homePlayers.length > 0 && g.awayPlayers.length > 0;

  const scored = g.scoreHome !== null && g.scoreAway !== null;

  return (
    <tr>
      <td className="text-ink-faint">Game {index + 1}</td>
      <td>
        <Pill tone="neutral">{g.courtLabel ?? "—"}</Pill>
      </td>
      <td className={g.winner === "A" ? "font-bold" : ""}>{names(g.homePlayers)}</td>
      <td className="text-center tabular-nums">
        {scored ? (
          <span>
            {g.scoreHome}–{g.scoreAway}
          </span>
        ) : (
          <span className="text-ink-faint">vs</span>
        )}
      </td>
      <td className={g.winner === "B" ? "font-bold" : ""}>{names(g.awayPlayers)}</td>
      {canScore && (
        <td>
          {assigned ? (
            <span className="inline-flex items-center gap-1.5">
              <Input
                aria-label="home score"
                value={home}
                onChange={(e) => setHome(e.target.value)}
                className="ctl ctl-sm w-14 text-center"
                inputMode="numeric"
              />
              <Input
                aria-label="away score"
                value={away}
                onChange={(e) => setAway(e.target.value)}
                className="ctl ctl-sm w-14 text-center"
                inputMode="numeric"
              />
              <Button
                size="sm"
                onClick={() => onScore(g.id, Number(home), Number(away))}
                disabled={home === "" || away === ""}
              >
                {scored ? "Edit" : "Save"}
              </Button>
            </span>
          ) : (
            <span className="text-xs text-ink-faint">Awaiting lineups</span>
          )}
        </td>
      )}
    </tr>
  );
}
