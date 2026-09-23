import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { InventoryItemView } from "../lib/types";
import { Icon } from "../components/Icon";
import { useToast } from "../components/Toast";
import { Alert, Button, Card, EmptyState, Loading, PageHeader } from "../components/ui";

/** A player's owned powerups (US20), with the ability to use one (US21). */
export function Inventory() {
  const { activeTournamentId } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState<InventoryItemView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usingId, setUsingId] = useState<string | null>(null);

  function load() {
    setError(null);
    api<{ inventory: InventoryItemView[] }>("/shop/inventory")
      .then((d) => setItems(d.inventory))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }

  useEffect(() => {
    setItems(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTournamentId]);

  async function use(item: InventoryItemView) {
    if (usingId) return;
    if (!window.confirm(`Use "${item.name}" now? This can't be undone.`)) return;
    setUsingId(item.id);
    try {
      await api(`/shop/inventory/${item.id}/use`, { method: "POST" });
      showToast(`Used ${item.name}.`, "success");
      setItems((cur) => cur?.filter((x) => x.id !== item.id) ?? cur);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not use powerup", "error");
    } finally {
      setUsingId(null);
    }
  }

  return (
    <>
      <PageHeader title="Inventory" subtitle="Powerups you own" />

      {error && <Alert tone="error">{error}</Alert>}
      {items === null && !error && <Loading />}

      {items && items.length === 0 && (
        <EmptyState icon="shop" title="No powerups yet" hint="Buy some in the Shop." />
      )}

      {items && items.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((i) => (
            <Card key={i.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold">{i.name}</div>
                  <p className="mt-1 text-sm text-ink-muted">{i.description}</p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 font-bold tabular-nums text-brand">
                  <Icon name="coins" size={14} />
                  {i.cost}
                </span>
              </div>
              <p className="mt-2 text-xs text-ink-faint">
                Bought {new Date(i.purchasedAt).toLocaleDateString()}
              </p>
              <div className="mt-3">
                <Button
                  className="w-full"
                  variant="secondary"
                  icon="bolt"
                  disabled={usingId === i.id}
                  onClick={() => use(i)}
                >
                  Use
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
