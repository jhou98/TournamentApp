import { useEffect, useState } from "react";
import { api } from "../lib/api";

interface PlayerView {
  id: string;
  displayName: string;
}
interface GameView {
  id: string;
  roundNo: number;
  courtLabel: string | null;
  status: string;
  homePlayers: PlayerView[];
  awayPlayers: PlayerView[];
  scoreHome: number | null;
  scoreAway: number | null;
  winner: "A" | "B" | null;
}
interface MatchView {
  roundNo: number;
  roundScore: { teamA: number; teamB: number };
  games: GameView[];
}
interface MatchupView {
  id: string;
  stage: string;
  roundIndex: number | null;
  status: string;
  teamAId: string;
  teamAName: string;
  teamBId: string;
  teamBName: string;
  winnerTeamId: string | null;
  winnerTeamName: string | null;
  matchupScore: { teamA: number; teamB: number };
  decided: boolean;
  tied: boolean;
  matches: MatchView[];
}
interface ResultsView {
  status: string;
  isAdmin: boolean;
  matchups: MatchupView[];
}

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

  return (
    <div style={{ maxWidth: 860, margin: "1.5rem auto" }}>
      <h1>Results</h1>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {notice && <p style={{ color: "green" }}>{notice}</p>}
      {data && data.matchups.length === 0 && <p>No matchups yet.</p>}
      {data?.matchups.map((m) => (
        <MatchupCard key={m.id} matchup={m} canScore={data.isAdmin} onScore={saveScore} />
      ))}
    </div>
  );
}

function MatchupCard({
  matchup: m,
  canScore,
  onScore,
}: {
  matchup: MatchupView;
  canScore: boolean;
  onScore: (gameId: string, h: number, a: number) => void;
}) {
  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <strong style={{ fontSize: 16 }}>
          {m.teamAName} {m.matchupScore.teamA}–{m.matchupScore.teamB} {m.teamBName}
        </strong>
        <span style={{ fontSize: 13, color: "#666" }}>
          {m.decided
            ? `✅ ${m.winnerTeamName} wins`
            : m.tied
              ? "Tied — sudden death"
              : m.status === "in_progress"
                ? "In progress"
                : "Scheduled"}
        </span>
      </div>

      {m.matches.map((match) => (
        <div key={match.roundNo} style={{ marginTop: 10 }}>
          <div style={{ fontSize: 13, color: "#555", marginBottom: 4 }}>
            <em>
              Match {match.roundNo}: {match.roundScore.teamA}–{match.roundScore.teamB}
            </em>
          </div>
          <table style={{ fontSize: 13, width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {match.games.map((g, i) => (
                <GameRow key={g.id} game={g} index={i} canScore={canScore} onScore={onScore} />
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function GameRow({
  game: g,
  index,
  canScore,
  onScore,
}: {
  game: GameView;
  index: number;
  canScore: boolean;
  onScore: (gameId: string, h: number, a: number) => void;
}) {
  const [home, setHome] = useState<string>(g.scoreHome?.toString() ?? "");
  const [away, setAway] = useState<string>(g.scoreAway?.toString() ?? "");
  const assigned = g.homePlayers.length > 0 && g.awayPlayers.length > 0;

  const scored = g.scoreHome !== null && g.scoreAway !== null;
  const homeStyle = g.winner === "A" ? { fontWeight: 700 } : {};
  const awayStyle = g.winner === "B" ? { fontWeight: 700 } : {};

  return (
    <tr>
      <td style={{ ...cell, color: "#999", width: 56 }}>Game {index + 1}</td>
      <td style={{ ...cell, color: "#999", width: 64 }}>{g.courtLabel ?? "—"}</td>
      <td style={{ ...cell, textAlign: "right", ...homeStyle }}>{names(g.homePlayers)}</td>
      <td style={{ ...cell, textAlign: "center", width: 90 }}>
        {scored ? (
          <span>
            {g.scoreHome}–{g.scoreAway}
          </span>
        ) : (
          <span style={{ color: "#bbb" }}>vs</span>
        )}
      </td>
      <td style={{ ...cell, ...awayStyle }}>{names(g.awayPlayers)}</td>
      {canScore && (
        <td style={{ ...cell, width: 160 }}>
          {assigned ? (
            <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
              <input
                aria-label="home score"
                value={home}
                onChange={(e) => setHome(e.target.value)}
                style={scoreInput}
                inputMode="numeric"
              />
              <input
                aria-label="away score"
                value={away}
                onChange={(e) => setAway(e.target.value)}
                style={scoreInput}
                inputMode="numeric"
              />
              <button
                onClick={() => onScore(g.id, Number(home), Number(away))}
                disabled={home === "" || away === ""}
              >
                {scored ? "Edit" : "Save"}
              </button>
            </span>
          ) : (
            <span style={{ color: "#bbb", fontSize: 12 }}>awaiting lineups</span>
          )}
        </td>
      )}
    </tr>
  );
}

const cardStyle = { border: "1px solid #ccc", borderRadius: 6, padding: 12, marginBottom: 12 } as const;
const cell = { borderBottom: "1px solid #f0f0f0", padding: "4px 8px" } as const;
const scoreInput = { width: 40, fontSize: 13, textAlign: "center" as const, padding: "2px 4px" };
