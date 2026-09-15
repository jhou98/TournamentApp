import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import type { LeaderboardRow, LeaderboardView } from "../../lib/types";
import { Icon } from "../../components/Icon";
import { useToast } from "../../components/Toast";
import { Alert, Avatar, Button, Card, EmptyState, Input, TeamChip } from "../../components/ui";

// Mirrors the server's MAX_COIN_ADJUSTMENT (domain/coinRule.ts). Kept in sync by
// hand; the server is authoritative and rejects anything larger with a 400.
const MAX_COIN_ADJUSTMENT = 1_000_000;

/**
 * Admin coin management (US17): manually credit or debit a player's coins.
 * Every change writes an auditable `admin_adjust` ledger row — never a delete —
 * so it survives recompute and shows up in the player's history. Balances are
 * scoped to the active tournament (D6).
 */
export function AdminCoins() {
  const { activeTournamentId } = useAuth();
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    setError(null);
    try {
      const data = await api<LeaderboardView>("/leaderboard");
      // Sort by name so admins can find a player quickly (the leaderboard's own
      // ranking is balance-order; here we want the roster alphabetically).
      setRows([...data.rows].sort((a, b) => a.displayName.localeCompare(b.displayName)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTournamentId]);

  return (
    <>
      {error && <Alert tone="error">{error}</Alert>}

      {loaded && rows.length === 0 && !error ? (
        <EmptyState
          icon="coins"
          title="No players yet"
          hint="Add players to a team in this tournament, then you can adjust their coins here."
        />
      ) : (
        <Card
          title="Adjust coins"
          subtitle="Credit or debit a player. Use a negative amount to reverse coins; add a note for the audit log."
        >
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <AdjustRow key={r.userId} player={r} onApplied={load} />
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

function AdjustRow({ player, onApplied }: { player: LeaderboardRow; onApplied: () => Promise<void> | void }) {
  const { showToast } = useToast();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const delta = Number(amount);
  const isNonZeroInt = amount.trim() !== "" && Number.isInteger(delta) && delta !== 0;

  async function apply() {
    if (!isNonZeroInt || busy) return;
    if (Math.abs(delta) > MAX_COIN_ADJUSTMENT) {
      showToast(
        `Amount is too large — adjustments must be between -${MAX_COIN_ADJUSTMENT.toLocaleString()} and ${MAX_COIN_ADJUSTMENT.toLocaleString()} coins.`,
        "error",
      );
      return;
    }
    setBusy(true);
    try {
      await api("/admin/coins/adjust", {
        method: "POST",
        body: JSON.stringify({ userId: player.userId, delta, note: note.trim() || undefined }),
      });
      showToast(
        `${delta > 0 ? "Added" : "Removed"} ${Math.abs(delta)} coins ${delta > 0 ? "to" : "from"} ${player.displayName}.`,
        "success",
      );
      setAmount("");
      setNote("");
      await onApplied();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Adjustment failed", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
      <Avatar name={player.displayName} size={28} />
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{player.displayName}</div>
        <div className="mt-0.5">
          {player.teamName ? (
            <TeamChip name={player.teamName} size={20} />
          ) : (
            <span className="text-xs text-ink-faint">No team</span>
          )}
        </div>
      </div>

      <span className="inline-flex items-center gap-1.5 font-bold tabular-nums text-brand" title="Current balance">
        <Icon name="coins" size={15} />
        {player.balance}
      </span>

      <Input
        type="number"
        inputMode="numeric"
        placeholder="±"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && apply()}
        className="w-20 text-right"
        aria-label={`Coins to add or remove for ${player.displayName}`}
      />
      <Input
        placeholder="Note (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && apply()}
        maxLength={200}
        className="w-44"
        aria-label={`Note for ${player.displayName}`}
      />
      <Button size="sm" icon="check" disabled={!isNonZeroInt || busy} onClick={apply}>
        Apply
      </Button>
    </li>
  );
}
