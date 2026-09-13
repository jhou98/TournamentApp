import { useEffect, useState, type ReactNode } from "react";
import { api } from "../lib/api";
import { AdminSchedule } from "./AdminSchedule";

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

export function Admin() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [teams, setTeams] = useState<TeamRoster[]>([]);
  const [newTeam, setNewTeam] = useState("");
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

  useEffect(() => {
    load();
  }, []);

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

  return (
    <div style={{ maxWidth: 820, margin: "1.5rem auto" }}>
      <h1>Admin — Roster</h1>
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <section style={{ marginBottom: 24 }}>
        <h2>Teams</h2>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            placeholder="New team name"
            value={newTeam}
            onChange={(e) => setNewTeam(e.target.value)}
          />
          <button
            onClick={() =>
              run(async () => {
                await api("/admin/teams", { method: "POST", body: JSON.stringify({ name: newTeam }) });
                setNewTeam("");
              })
            }
            disabled={!newTeam.trim()}
          >
            Create team
          </button>
          <button onClick={() => run(() => api("/admin/teams/auto-balance", { method: "POST" }))}>
            Auto-balance players
          </button>
        </div>

        {teams.length === 0 && <p>No teams yet.</p>}
        {teams.map((team) => (
          <div key={team.id} style={cardStyle}>
            <strong>{team.name}</strong> ({team.members.length})
            <button
              style={miniBtn}
              onClick={() => {
                if (window.confirm(`Remove team "${team.name}"? Its players will be unassigned.`)) {
                  run(() => api(`/admin/teams/${team.id}`, { method: "DELETE" }));
                }
              }}
            >
              remove team
            </button>
            <ul style={{ margin: "6px 0" }}>
              {team.members.map((m) => (
                <li key={m.userId}>
                  {m.displayName} (@{m.username}) — {m.role}
                  {m.role !== "captain" && (
                    <button
                      style={miniBtn}
                      onClick={() =>
                        run(() =>
                          api(`/admin/teams/${team.id}/captain`, {
                            method: "POST",
                            body: JSON.stringify({ userId: m.userId }),
                          }),
                        )
                      }
                    >
                      make captain
                    </button>
                  )}
                  <button
                    style={miniBtn}
                    onClick={() =>
                      run(() => api(`/admin/teams/${team.id}/members/${m.userId}`, { method: "DELETE" }))
                    }
                  >
                    remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section>
        <h2>Users</h2>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <Th>Display name</Th>
              <Th>Username</Th>
              <Th>Admin</Th>
              <Th>Team</Th>
              <Th>Assign to team</Th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const team = teamOf(u.id);
              return (
                <tr key={u.id}>
                  <Td>{u.displayName}</Td>
                  <Td>@{u.username}</Td>
                  <Td>
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
                  </Td>
                  <Td>{team?.name ?? "—"}</Td>
                  <Td>
                    <select
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
                    </select>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <AdminSchedule />
    </div>
  );
}

const cardStyle = { border: "1px solid #ccc", borderRadius: 6, padding: 10, marginBottom: 8 } as const;
const miniBtn = { marginLeft: 8, fontSize: 12 } as const;

function Th({ children }: { children: ReactNode }) {
  return <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 4 }}>{children}</th>;
}
function Td({ children }: { children: ReactNode }) {
  return <td style={{ borderBottom: "1px solid #eee", padding: 4 }}>{children}</td>;
}
