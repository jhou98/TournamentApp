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
interface PlayerOption extends RosterMember {
  teamName: string;
}

const MAX_COIN_ADJUSTMENT = 1_000_000; // mirrors the server cap (domain/coinRule.ts)

/**
 * Admin bounty management (US16): put a coin reward on a player or team, or
 * leave it OPEN for the first player/team to complete it. Awarding credits the
 * winner (one player, or every current team member) and closes the bounty out.
 */
export function AdminBounties() {
  const { activeTournamentId } = useAuth();
  const { showToast } = useToast();
  const [bounties, setBounties] = useState<BountyView[]>([]);
  const [teams, setTeams] = useState<TeamRoster[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [targetType, setTargetType] = useState<BountyTargetType>("player");
  const [open, setOpen] = useState(false);
  const [targetId, setTargetId] = useState("");
  const [description, setDescription] = useState("");
  const [coinValue, setCoinValue] = useState("");
  const [busy, setBusy] = useState(false);

  const players: PlayerOption[] = useMemo(
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
    (open || targetId !== "") &&
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
        body: JSON.stringify({
          targetType,
          description: description.trim(),
          coinValue: coins,
          ...(open ? {} : { targetId }),
        }),
      });
      showToast(open ? "Open bounty created." : "Bounty created.", "success");
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

  async function award(b: BountyView, winnerId?: string) {
    try {
      const res = await api<{ recipients: number }>(`/admin/bounties/${b.id}/award`, {
        method: "POST",
        body: JSON.stringify(winnerId ? { winnerId } : {}),
      });
      showToast(
        `Awarded ${b.coinValue} coins to ${res.recipients} ${res.recipients === 1 ? "player" : "players"}.`,
        "success",
      );
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not award bounty", "error");
    }
  }

  async function toggleVisible(b: BountyView) {
    try {
      await api(`/admin/bounties/${b.id}/visibility`, {
        method: "PATCH",
        body: JSON.stringify({ visible: !b.visible }),
      });
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not update visibility", "error");
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

      <Card className="mb-5" title="New bounty" subtitle="Reward a specific target, or leave it open for the first to complete it.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Scope">
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
            <Select value={targetId} disabled={open} onChange={(e) => setTargetId(e.target.value)}>
              <option value="">{open ? "Open — decided on award" : "Select…"}</option>
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

          <Field label="Coins">
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              placeholder="e.g. 100"
              value={coinValue}
              onChange={(e) => setCoinValue(e.target.value)}
            />
          </Field>

          <Field label="Description">
            <Input
              placeholder="What earns it?"
              value={description}
              maxLength={200}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
            />
          </Field>
        </div>

        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} />
          <span>
            <span className="font-semibold">Open bounty</span>{" "}
            <span className="text-ink-muted">
              — first {targetType === "player" ? "player" : "team"} to complete it wins; you pick the winner when awarding.
            </span>
          </span>
        </label>

        <div className="mt-3">
          <Button icon="plus" disabled={!canCreate || busy} onClick={create}>
            Create bounty
          </Button>
        </div>
      </Card>

      {bounties.length === 0 ? (
        <EmptyState icon="flag" title="No bounties yet" hint="Create one above to reward a play." />
      ) : (
        <Card title="Bounties" subtitle="Only visible, active bounties show up for players. Award one when it's earned.">
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Bounty</th>
                  <th>Target</th>
                  <th className="text-right">Coins</th>
                  <th>Status</th>
                  <th>Visible</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bounties.map((b) => (
                  <BountyRow
                    key={b.id}
                    bounty={b}
                    players={players}
                    teams={teams}
                    onAward={award}
                    onToggleVisible={toggleVisible}
                    onDelete={remove}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}

function BountyRow({
  bounty: b,
  players,
  teams,
  onAward,
  onToggleVisible,
  onDelete,
}: {
  bounty: BountyView;
  players: PlayerOption[];
  teams: TeamRoster[];
  onAward: (b: BountyView, winnerId?: string) => void;
  onToggleVisible: (b: BountyView) => void;
  onDelete: (b: BountyView) => void;
}) {
  const [winner, setWinner] = useState("");
  const scopeLabel = b.targetType === "player" ? "any player" : "any team";

  return (
    <tr>
      <td className="font-semibold">{b.description}</td>
      <td>
        {b.open && !b.targetName ? (
          <span className="inline-flex items-center gap-1.5 text-ink-muted">
            <Icon name="target" size={14} />
            Open · {scopeLabel}
          </span>
        ) : b.targetType === "team" && b.targetName ? (
          <span className="inline-flex items-center gap-1.5">
            <TeamChip name={b.targetName} size={20} />
            {b.open && <Pill tone="neutral">was open</Pill>}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <Icon name="user" size={14} />
            {b.targetName ?? <span className="text-ink-faint">(removed)</span>}
            {b.open && <Pill tone="neutral">was open</Pill>}
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
        <input
          type="checkbox"
          checked={b.visible}
          onChange={() => onToggleVisible(b)}
          aria-label={b.visible ? "Visible to players" : "Hidden from players"}
          title={b.visible ? "Visible to players" : "Hidden from players"}
        />
      </td>
      <td>
        <div className="flex items-center justify-end gap-2">
          {b.active && b.open ? (
            <>
              <Select
                className="ctl ctl-sm w-40"
                value={winner}
                onChange={(e) => setWinner(e.target.value)}
                aria-label="Winner"
              >
                <option value="">Winner…</option>
                {b.targetType === "player"
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
              <Button size="sm" icon="coins" disabled={!winner} onClick={() => onAward(b, winner)}>
                Award
              </Button>
            </>
          ) : (
            b.active && (
              <Button size="sm" icon="coins" onClick={() => onAward(b)}>
                Award
              </Button>
            )
          )}
          <Button variant="ghost" size="sm" onClick={() => onDelete(b)}>
            Delete
          </Button>
        </div>
      </td>
    </tr>
  );
}
