import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import type { PowerupView } from "../../lib/types";
import { Icon } from "../../components/Icon";
import { useToast } from "../../components/Toast";
import { Alert, Button, Card, EmptyState, Field, Input } from "../../components/ui";

const MAX_COST = 1_000_000; // mirrors the server cap (domain/coinRule.ts)

/**
 * Admin shop catalog management (US19, scoped down for now): create, edit and
 * remove power-ups with a name, description and coin cost. Stock is
 * unlimited — every powerup here is buyable by any number of players (US20).
 */
export function AdminPowerups() {
  const { activeTournamentId } = useAuth();
  const { showToast } = useToast();
  const [powerups, setPowerups] = useState<PowerupView[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setError(null);
    try {
      const res = await api<{ powerups: PowerupView[] }>("/admin/powerups");
      setPowerups(res.powerups);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTournamentId]);

  const costValue = Number(cost);
  const canCreate =
    name.trim() !== "" &&
    description.trim() !== "" &&
    cost.trim() !== "" &&
    Number.isInteger(costValue) &&
    costValue > 0 &&
    costValue <= MAX_COST;

  async function create() {
    if (!canCreate || busy) return;
    setBusy(true);
    try {
      await api("/admin/powerups", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), description: description.trim(), cost: costValue }),
      });
      showToast("Powerup added.", "success");
      setName("");
      setDescription("");
      setCost("");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not add powerup", "error");
    } finally {
      setBusy(false);
    }
  }

  async function save(id: string, patch: { name: string; description: string; cost: number }) {
    try {
      await api(`/admin/powerups/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
      showToast("Powerup updated.", "success");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not update powerup", "error");
    }
  }

  async function remove(p: PowerupView) {
    if (!window.confirm(`Delete powerup "${p.name}"? Anyone who owns it will lose it.`)) return;
    try {
      await api(`/admin/powerups/${p.id}`, { method: "DELETE" });
      showToast("Powerup deleted.", "success");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not delete powerup", "error");
    }
  }

  return (
    <>
      {error && <Alert tone="error">{error}</Alert>}

      <Card className="mb-5" title="New powerup" subtitle="Unlimited stock — any number of players can buy one.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Name">
            <Input placeholder="e.g. Extra Serve" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
          </Field>

          <Field label="Cost">
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              placeholder="e.g. 50"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
            />
          </Field>

          <Field label="Description" className="sm:col-span-2">
            <Input
              placeholder="What does it do?"
              value={description}
              maxLength={200}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
            />
          </Field>
        </div>

        <div className="mt-3">
          <Button icon="plus" disabled={!canCreate || busy} onClick={create}>
            Add powerup
          </Button>
        </div>
      </Card>

      {powerups.length === 0 ? (
        <EmptyState icon="shop" title="No powerups yet" hint="Add one above to start the shop catalog." />
      ) : (
        <Card title="Powerups" subtitle="Players can buy one of each in the Shop.">
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th className="text-right">Cost</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {powerups.map((p) => (
                  <PowerupRow key={p.id} powerup={p} onSave={save} onDelete={remove} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}

function PowerupRow({
  powerup: p,
  onSave,
  onDelete,
}: {
  powerup: PowerupView;
  onSave: (id: string, patch: { name: string; description: string; cost: number }) => Promise<void>;
  onDelete: (p: PowerupView) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(p.name);
  const [description, setDescription] = useState(p.description);
  const [cost, setCost] = useState(String(p.cost));
  const [busy, setBusy] = useState(false);

  const costValue = Number(cost);
  const canSave =
    name.trim() !== "" &&
    description.trim() !== "" &&
    cost.trim() !== "" &&
    Number.isInteger(costValue) &&
    costValue > 0 &&
    costValue <= MAX_COST;

  function startEdit() {
    setName(p.name);
    setDescription(p.description);
    setCost(String(p.cost));
    setEditing(true);
  }

  async function save() {
    if (!canSave || busy) return;
    setBusy(true);
    try {
      await onSave(p.id, { name: name.trim(), description: description.trim(), cost: costValue });
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <tr>
        <td>
          <Input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} aria-label="Name" />
        </td>
        <td>
          <Input value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} aria-label="Description" />
        </td>
        <td className="text-right">
          <Input
            className="w-24 text-right"
            type="number"
            inputMode="numeric"
            min={1}
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            aria-label="Cost"
          />
        </td>
        <td>
          <div className="flex items-center justify-end gap-2">
            <Button size="sm" icon="check" disabled={!canSave || busy} onClick={save}>
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="font-semibold">{p.name}</td>
      <td className="text-ink-muted">{p.description}</td>
      <td className="text-right">
        <span className="inline-flex items-center gap-1.5 font-bold tabular-nums text-brand">
          <Icon name="coins" size={14} />
          {p.cost}
        </span>
      </td>
      <td>
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={startEdit}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete(p)}>
            Delete
          </Button>
        </div>
      </td>
    </tr>
  );
}
