import { useEffect, useState } from "react";
import { api } from "../lib/api";

interface StandingRow {
  teamId: string;
  teamName: string;
  matchupsPlayed: number;
  matchupsWon: number;
  matchupsLost: number;
  matchupsTied: number;
  points: number;
  gamesWon: number;
  gamesLost: number;
  gameDiff: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  rank: number;
}

interface StandingsView {
  status: string;
  rows: StandingRow[];
}

const fmt = (n: number) => (n > 0 ? `+${n}` : `${n}`);

export function Standings() {
  const [data, setData] = useState<StandingsView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<StandingsView>("/standings")
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  return (
    <div style={{ maxWidth: 820, margin: "1.5rem auto" }}>
      <h1>Standings</h1>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {data && data.rows.length === 0 && <p>No teams yet.</p>}
      {data && data.rows.length > 0 && (
        <>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 14 }}>
            <thead>
              <tr>
                {["#", "Team", "Pts", "W–L–T", "Games", "Game Diff", "Pt Diff"].map((h) => (
                  <th key={h} style={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.teamId}>
                  <td style={td}>{r.rank}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{r.teamName}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{r.points}</td>
                  <td style={td}>
                    {r.matchupsWon}–{r.matchupsLost}–{r.matchupsTied}
                  </td>
                  <td style={td}>
                    {r.gamesWon}–{r.gamesLost}
                  </td>
                  <td style={td}>{fmt(r.gameDiff)}</td>
                  <td style={td}>{fmt(r.pointDiff)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: 12, color: "#777", marginTop: 8 }}>
            Points: win 3, tie 1, loss 0. Ranked by points, then game differential, then point
            differential. Round-robin matchups can end in a tie (no overtime in pool play). Rank
            seeds the playoff bracket once pool play ends.
          </p>
        </>
      )}
    </div>
  );
}

const th = {
  textAlign: "left" as const,
  borderBottom: "2px solid #ccc",
  padding: "6px 10px",
};
const td = { borderBottom: "1px solid #eee", padding: "6px 10px" };
