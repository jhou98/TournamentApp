import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { Alert, Avatar, Card, EmptyState, Input, Pill, Select, TeamChip } from "../../components/ui";

interface AdminUser {
  id: string;
  username: string;
  displayName: string;
  isAdmin: boolean;
}

interface RosterMember {
  userId: string;
  username: string;
  displayName: string;
  role: "captain" | "member";
}

interface TeamRoster {
  id: string;
  name: string;
  members: RosterMember[];
}

export function AdminUsers() {
  const { activeTournamentId } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [teams, setTeams] = useState<TeamRoster[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const [u, t] = await Promise.all([
        api<{ users: AdminUser[] }>("/admin/users"),
        api<{ teams: TeamRoster[] }>("/admin/teams"),
      ]);
      setUsers(u.users);
      setTeams(t.teams);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }

  // Reload the roster whenever the active tournament changes — everything below
  // is scoped to it (US28).
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTournamentId]);

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
  }

  const teamOf = (userId: string) =>
    teams.find((t) => t.members.some((m) => m.userId === userId));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => u.displayName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q),
    );
  }, [users, search]);

  return (
    <>
      {error && <Alert tone="error">{error}</Alert>}
      <Card
        title="Manage users"
        action={
          <Input
            placeholder="Search users…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56"
          />
        }
      >
        {filtered.length === 0 ? (
          <EmptyState icon="users" title="No users found" hint="Try a different search." />
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Team</th>
                <th>Assign</th>
                <th>Admin</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const team = teamOf(u.id);
                const isCaptain = team?.members.some((m) => m.userId === u.id && m.role === "captain");
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <Avatar name={u.displayName} size={28} />
                        <div className="min-w-0">
                          <div className="font-semibold">{u.displayName}</div>
                          <div className="text-xs text-ink-muted">@{u.username}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {u.isAdmin ? (
                        <Pill tone="brand">Admin</Pill>
                      ) : isCaptain ? (
                        <Pill tone="info" icon="flag">Captain</Pill>
                      ) : (
                        <Pill tone="neutral">Player</Pill>
                      )}
                    </td>
                    <td>{team ? <TeamChip name={team.name} /> : <span className="text-ink-faint">—</span>}</td>
                    <td>
                      <Select
                        className="ctl ctl-sm"
                        value={team?.id ?? ""}
                        onChange={(e) =>
                          run(() =>
                            api(`/admin/teams/${e.target.value}/members`, {
                              method: "POST",
                              body: JSON.stringify({ userId: u.id }),
                            }),
                          )
                        }
                      >
                        <option value="" disabled>
                          select…
                        </option>
                        {teams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={u.isAdmin}
                        onChange={(e) =>
                          run(() =>
                            api(`/admin/users/${u.id}`, {
                              method: "PATCH",
                              body: JSON.stringify({ isAdmin: e.target.checked }),
                            }),
                          )
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
