import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { CoinSummaryView, PurchaseResult, ShopPowerupView } from "../lib/types";
import { Icon } from "../components/Icon";
import { useToast } from "../components/Toast";
import { Alert, Button, Card, EmptyState, Loading, PageHeader, Pill } from "../components/ui";

/** Player shop (US20, scoped down for now): buy a powerup with coins. Owning one caps it at one — an owned powerup can't be bought again. */
export function Shop() {
  const { activeTournamentId } = useAuth();
  const { showToast } = useToast();
  const [powerups, setPowerups] = useState<ShopPowerupView[] | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [buyingId, setBuyingId] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const [shop, coins] = await Promise.all([
        api<{ powerups: ShopPowerupView[] }>("/shop"),
        api<CoinSummaryView>("/me/coins"),
      ]);
      setPowerups(shop.powerups);
      setBalance(coins.balance);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTournamentId]);

  async function buy(p: ShopPowerupView) {
    if (buyingId) return;
    setBuyingId(p.id);
    try {
      const res = await api<PurchaseResult>(`/shop/${p.id}/buy`, { method: "POST" });
      setBalance(res.balance);
      setPowerups((cur) => cur?.map((x) => (x.id === p.id ? { ...x, owned: true } : x)) ?? cur);
      showToast(`Bought ${p.name}.`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not buy powerup", "error");
    } finally {
      setBuyingId(null);
    }
  }

  const owned = powerups?.filter((p) => p.owned) ?? [];

  return (
    <>
      <PageHeader
        title="Shop"
        subtitle="Spend coins on power-ups"
        actions={
          balance !== null && (
            <span className="inline-flex items-center gap-1.5 font-bold tabular-nums text-brand">
              <Icon name="coins" size={16} />
              {balance} coins
            </span>
          )
        }
      />

      {error && <Alert tone="error">{error}</Alert>}
      {powerups === null && !error && <Loading />}

      {powerups && (
        <>
          <Alert tone="info">
            You can own at most one of each powerup — once you've bought it, it won't be buyable again.{" "}
            <Link to="/inventory" className="font-semibold underline">
              View your inventory
            </Link>
            .
          </Alert>

          {owned.length > 0 && (
            <Card className="mb-5" title="Your powerups" subtitle="Already owned — see the full list in your inventory.">
              <div className="flex flex-wrap gap-2">
                {owned.map((p) => (
                  <Pill key={p.id} tone="success" icon="check">
                    {p.name}
                  </Pill>
                ))}
              </div>
            </Card>
          )}

          {powerups.length === 0 ? (
            <EmptyState icon="shop" title="No powerups yet" hint="Check back — the admin can add powerups any time." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {powerups.map((p) => {
                const canAfford = balance !== null && balance >= p.cost;
                const disabled = p.owned || !canAfford || buyingId === p.id;
                return (
                  <Card key={p.id} className={p.owned ? "opacity-60" : undefined}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold">{p.name}</div>
                        <p className="mt-1 text-sm text-ink-muted">{p.description}</p>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1.5 font-bold tabular-nums text-brand">
                        <Icon name="coins" size={14} />
                        {p.cost}
                      </span>
                    </div>
                    <div className="mt-3">
                      <Button
                        className="w-full"
                        variant={p.owned ? "secondary" : "primary"}
                        icon={p.owned ? "check" : "coins"}
                        disabled={disabled}
                        onClick={() => buy(p)}
                      >
                        {p.owned ? "Owned" : canAfford ? "Buy" : "Not enough coins"}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </>
  );
}
