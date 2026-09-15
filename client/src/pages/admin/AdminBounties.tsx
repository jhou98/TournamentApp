import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import type { BountyTargetType, BountyView } from "../../lib/types";
import { Icon } from "../../components/Icon";
import { useToast } from "../../components/Toast";
import { Alert, Button, Card, EmptyState, Field, Input, Pill, Select, TeamChip } from "../../components/ui";

interface RosterMember {
  userId: string;
  displayName: string;
}
interface TeamRoster {
  id: string;
  name: string;
  members: RosterMember[];
}

const MAX_COIN_ADJUSTMENT = 1_000_000; // mirrors the server cap (domain/coinRule.ts)

/**
 * Admin bounty management (US16): put a coin reward on a player or team, then
 * award it when earned. Awarding credits the target (one player, or every
 * current team member) with `bounty` coins and closes the bounty out.
 */
export function AdminBounties() {
  const { activeTournamentId } = useAuth();
  const { showToast } = useToast();
  const [bounties, setBounties] = useState<BountyView[]>([]);
  const [teams, setTeams] = useState<TeamRoster[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [targetType, setTargetType] = useState<BountyTargetType>("player");
  const [targetId, setTargetId] = useState("");
  const [description, setDescription] = useState("");
  const [coinValue, setCoinValue] = useState("");
  const [busy, setBusy] = useState(false);

  const players = useMemo(
    () => teams.flatMap((t) => t.members.map((m) => ({ ...m, teamName: t.name }))),
    [teams],
  );

  async function load() {
    setError(null);
    try {
      const [b, t] = await Promise.all([
        api<{ bounties: BountyView[] }>("/admin/bounties"),
        api<{ teams: TeamRoster[] }>("/admin/teams"),
      ]);
      setBounties(b.bounties);
      setTeams(t.teams);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTournamentId]);

  const coins = Number(coinValue);
  const canCreate =
    targetId !== "" &&
    description.trim() !== "" &&
    coinValue.trim() !== "" &&
    Number.isInteger(coins) &&
    coins > 0 &&
    coins <= MAX_COIN_ADJUSTMENT;

  async function create() {
    if (!canCreate || busy) return;
    setBusy(true);
    try {
      await api("/admin/bounties", {
        method: "POST",
        body: JSON.stringify({ targetType, targetId, description: description.trim(), coinValue: coins }),
      });
      showToast("Bounty created.", "success");
      setDescription("");
      setCoinValue("");
      setTargetId("");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not create bounty", "error");
    } finally {
      setBusy(false);
    }
  }

  async function award(b: BountyView) {
    try {
      const res = await api<{ recipients: number }>(`/admin/bounties/${b.id}/award`, { method: "POST" });
      showToast(
        `Awarded ${b.coinValue} coins to ${res.recipients} ${res.recipients === 1 ? "player" : "players"}.`,
        "success",
      );
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not award bounty", "error");
    }
  }

  async function remove(b: BountyView) {
    if (!window.confirm(`Delete bounty "${b.description}"?`)) return;
    try {
      await api(`/admin/bounties/${b.id}`, { method: "DELETE" });
      showToast("Bounty deleted.", "success");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not delete bounty", "error");
    }
  }

  return (
    <>
      {error && <Alert tone="error">{error}</Alert>}

      <Card className="mb-5" title="New bounty" subtitle="Reward a player or team when they pull something off.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Target">
            <Select
              value={targetType}
              onChange={(e) => {
                setTargetType(e.target.value as BountyTargetType);
                setTargetId("");
              }}
            >
              <option value="player">Player</option>
              <option value="team">Team</option>
            </Select>
          </Field>

          <Field label={targetType === "player" ? "Player" : "Team"}>
            <Select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
              <option value="">Select…</option>
              {targetType === "player"
                ? players.map((p) => (
                    <option key={p.userId} value={p.userId}>
                      {p.displayName} · {p.teamName}
                    </option>
                  ))
                : teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
            </Select>
          </Field>

          <Field label="Coins" className="lg:col-span-1">
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              placeholder="e.g. 100"
              value={coinValue}
              onChange={(e) => setCoinValue(e.target.value)}
            />
          </Field>

          <Field label="Description" className="sm:col-span-2 lg:col-span-1">
            <Input
              placeholder="What earns it?"
              value={description}
              maxLength={200}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
            />
          </Field>
        </div>
        <div className="mt-3">
          <Button icon="plus" disabled={!canCreate || busy} onClick={create}>
            Create bounty
          </Button>
        </div>
      </Card>

      {bounties.length === 0 ? (
        <EmptyState icon="flag" title="No bounties yet" hint="Create one above to reward a play." />
      ) : (
        <Card title="Bounties" subtitle="Active bounties are visible to players. Award one when it's earned.">
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Bounty</th>
                  <th>Target</th>
                  <th className="text-right">Coins</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bounties.map((b) => (
                  <tr key={b.id}>
                    <td className="font-semibold">{b.description}</td>
                    <td>
                      {b.targetType === "team" && b.targetName ? (
                        <TeamChip name={b.targetName} size={20} />
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          <Icon name="user" size={14} />
                          {b.targetName ?? <span className="text-ink-faint">(removed)</span>}
                        </span>
                      )}
                    </td>
                    <td className="text-right">
                      <span className="inline-flex items-center gap-1.5 font-bold tabular-nums text-brand">
                        <Icon name="coins" size={14} />
                        {b.coinValue}
                      </span>
                    </td>
                    <td>
                      {b.active ? (
                        <Pill tone="brand" icon="flag">
                          Active
                        </Pill>
                      ) : (
                        <Pill tone="success" icon="check">
                          Awarded
                        </Pill>
                      )}
                    </td>
                    <td>
                      <div className="flex justify-end gap-2">
                        {b.active && (
                          <Button size="sm" icon="coins" onClick={() => award(b)}>
                            Award
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => remove(b)}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
