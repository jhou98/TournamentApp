import { Outlet } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { PageHeader, StatusPill, Tabs } from "../../components/ui";

/** Tournament Tracker: one page, three tabs (Schedule / Results / Standings). */
export function TournamentHub() {
  const { tournaments, activeTournamentId } = useAuth();
  const active = tournaments.find((t) => t.id === activeTournamentId);
  return (
    <>
      <PageHeader
        title="Tournament Tracker"
        subtitle="Live schedule, scores and standings"
        actions={active ? <StatusPill status={active.status} /> : undefined}
      />
      <Tabs
        tabs={[
          { to: "/tournament/schedule", label: "Schedule" },
          { to: "/tournament/results", label: "Results" },
          { to: "/tournament/standings", label: "Standings" },
        ]}
      />
      <Outlet />
    </>
  );
}
