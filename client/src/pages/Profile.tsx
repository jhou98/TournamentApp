import { useAuth } from "../lib/auth";

export function Profile() {
  const { profile } = useAuth();
  if (!profile) return null;

  const { user, role, team, captain } = profile;

  return (
    <div style={{ maxWidth: 480, margin: "2rem auto" }}>
      <h1>{user.displayName}</h1>
      <dl>
        <Row label="Username" value={user.username} />
        <Row label="Role" value={role} />
        <Row label="Team" value={team ? team.name : "— not assigned —"} />
        <Row
          label="Captain"
          value={captain ? `${captain.displayName} (@${captain.username})` : "— none —"}
        />
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 8, padding: "4px 0" }}>
      <dt style={{ width: 100, fontWeight: 600 }}>{label}</dt>
      <dd style={{ margin: 0 }}>{value}</dd>
    </div>
  );
}
