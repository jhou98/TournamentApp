import { useAuth } from "../lib/auth";
import { Avatar, Card, PageHeader, Pill, StatusPill, TeamMark, type PillTone } from "../components/ui";

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

export function Profile() {
  const { profile, tournaments, activeTournamentId } = useAuth();
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
