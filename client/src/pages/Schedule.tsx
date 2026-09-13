import { useEffect, useState } from "react";
import { api } from "../lib/api";

interface GameView {
  id: string;
  roundNo: number;
  courtId: string | null;
  courtLabel: string | null;
  status: string;
}

interface MatchupView {
  id: string;
  roundIndex: number | null;
  stage: string;
  status: string;
  teamAId: string;
  teamAName: string;
  teamBId: string;
  teamBName: string;
  games: GameView[];
}

interface RoundView {
  roundIndex: number;
  matchups: MatchupView[];
}

export interface ScheduleView {
  status: string;
  courts: { id: string; label: string }[];
  rounds: RoundView[];
}

export function Schedule() {
  const [schedule, setSchedule] = useState<ScheduleView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<ScheduleView>("/schedule")
      .then(setSchedule)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  return (
    <div style={{ maxWidth: 820, margin: "1.5rem auto" }}>
      <h1>Schedule</h1>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {schedule && schedule.rounds.length === 0 && (
        <p>The schedule hasn’t been generated yet.</p>
      )}
      {schedule?.rounds.map((round) => (
        <section key={round.roundIndex} style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 18 }}>Round {round.roundIndex}</h2>
          {round.matchups.map((m) => (
            <MatchupCard key={m.id} matchup={m} />
          ))}
        </section>
      ))}
    </div>
  );
}

function MatchupCard({ matchup }: { matchup: MatchupView }) {
  const byRound = new Map<number, GameView[]>();
  for (const g of matchup.games) {
    byRound.set(g.roundNo, [...(byRound.get(g.roundNo) ?? []), g]);
  }
  return (
    <div style={cardStyle}>
      <strong>
        {matchup.teamAName} vs {matchup.teamBName}
      </strong>
      {[...byRound.entries()].map(([roundNo, games]) => (
        <div key={roundNo} style={{ margin: "6px 0", fontSize: 14 }}>
          <em>Round {roundNo}:</em>{" "}
          {games.map((g) => g.courtLabel ?? "—").join(", ")}
        </div>
      ))}
    </div>
  );
}

const cardStyle = { border: "1px solid #ccc", borderRadius: 6, padding: 10, marginBottom: 8 } as const;
