import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { orderRounds, type CoinRule, type EconomyRules, type PotluckView, type ScheduleView, type StreakRule } from "../../lib/types";
import { useToast } from "../../components/Toast";
import { Alert, Button, Card, EmptyState, Field, InfoHint, Input, Select, StatusPill } from "../../components/ui";

interface TournamentConfig {
  id: string;
  name: string;
  status: string;
  teamCount: number;
  teamSize: number;
  pairSize: number;
  pairsPerLineup: number;
  roundsPerMatchup: number;
  roundRobinCycles: number;
  playoffQualifiers: number;
  courtCount: number;
}

type ConfigKey =
  | "teamCount"
  | "teamSize"
  | "pairSize"
  | "pairsPerLineup"
  | "roundsPerMatchup"
  | "roundRobinCycles"
  | "playoffQualifiers"
  | "courtCount";

const CONFIG_FIELDS: { key: ConfigKey; label: string }[] = [
  { key: "teamCount", label: "Teams" },
  { key: "teamSize", label: "Players / team" },
  { key: "pairSize", label: "Players / pair" },
  { key: "pairsPerLineup", label: "Pairs / match" },
  { key: "roundsPerMatchup", label: "Matches / matchup" },
  { key: "roundRobinCycles", label: "Round-robin cycles" },
  { key: "playoffQualifiers", label: "Playoff qualifiers" },
  { key: "courtCount", label: "Courts" },
];

interface TeamRef {
  id: string;
  name: string;
}

export function AdminSettings() {
  const [config, setConfig] = useState<TournamentConfig | null>(null);
  const [draft, setDraft] = useState<Record<ConfigKey, number> | null>(null);
  const [schedule, setSchedule] = useState<ScheduleView | null>(null);
  const [teams, setTeams] = useState<TeamRef[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const [c, s, t] = await Promise.all([
        api<{ config: TournamentConfig }>("/admin/tournament/config"),
        api<ScheduleView>("/schedule"),
        api<{ teams: TeamRef[] }>("/admin/teams"),
      ]);
      setConfig(c.config);
      setDraft(Object.fromEntries(CONFIG_FIELDS.map((f) => [f.key, c.config[f.key]])) as Record<ConfigKey, number>);
      setSchedule(s);
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

  if (!config || !draft) {
    return error ? <Alert tone="error">{error}</Alert> : null;
  }

  const isSetup = config.status === "setup";

  return (
    <>
      {error && <Alert tone="error">{error}</Alert>}

      {/* --- Shop visibility ------------------------------------------------ */}
      <ShopVisibilityCard />

      {/* --- Potluck details ------------------------------------------------ */}
      <PotluckSettingsCard />

      {/* --- Config -------------------------------------------------------- */}
      <Card
        title="Tournament config"
        subtitle={!isSetup ? "Config is locked once the schedule is generated. Reset to edit." : undefined}
        action={<StatusPill status={config.status} />}
        className="mb-5"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CONFIG_FIELDS.map((f) => (
            <Field key={f.key} label={f.label}>
              <Input
                type="number"
                min={1}
                value={draft[f.key]}
                disabled={!isSetup}
                onChange={(e) => setDraft({ ...draft, [f.key]: Number(e.target.value) })}
              />
            </Field>
          ))}
        </div>
        {isSetup ? (
          <Button
            className="mt-4"
            onClick={() => run(() => api("/admin/tournament/config", { method: "PATCH", body: JSON.stringify(draft) }))}
          >
            Save config
          </Button>
        ) : (
          <p className="mt-4 text-xs text-ink-muted">Config is locked while the schedule is active.</p>
        )}
      </Card>

      {/* --- Coin & streak rules ------------------------------------------ */}
      <RulesCard />

      {/* --- Generate / reset / seed playoffs ----------------------------- */}
      <Card title="Schedule" className="mb-5">
        <div className="flex flex-wrap gap-2">
          {isSetup ? (
            <Button onClick={() => run(() => api("/admin/schedule/generate", { method: "POST" }))}>
              Generate schedule
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => run(() => api("/admin/schedule/reset", { method: "POST" }))}>
              Reset schedule
            </Button>
          )}
          {config.status === "round_robin" && (
            <Button
              variant="dark"
              onClick={() => {
                if (
                  window.confirm(
                    "Seed the playoffs from the current standings? Enter every round-robin result first.",
                  )
                ) {
                  run(() => api("/admin/playoffs/seed", { method: "POST" }));
                }
              }}
            >
              Seed playoffs
            </Button>
          )}
        </div>
        {config.status === "playoffs" && (
          <Alert tone="info">
            Playoffs are underway — manage lineups and enter scores from the Captain Panel and Results pages. The final and
            third-place game are created automatically once both semifinals finish.
          </Alert>
        )}
        {config.status === "completed" && <Alert tone="info">🏆 Tournament complete.</Alert>}
      </Card>

      {/* --- Courts -------------------------------------------------------- */}
      {schedule && schedule.courts.length > 0 && (
        <Card title="Courts" className="mb-5">
          <div className="flex flex-wrap gap-2">
            {schedule.courts.map((court) => (
              <input
                key={court.id}
                defaultValue={court.label}
                className="ctl ctl-sm w-28"
                onBlur={(e) => {
                  const label = e.target.value.trim();
                  if (label && label !== court.label) {
                    run(() => api(`/admin/courts/${court.id}`, { method: "PATCH", body: JSON.stringify({ label }) }));
                  }
                }}
              />
            ))}
          </div>
        </Card>
      )}

      {/* --- Rounds / matchups / games ------------------------------------ */}
      {schedule?.rounds.length === 0 && (
        <EmptyState icon="calendar" title="No schedule yet — generate one above." />
      )}
      {schedule && orderRounds(schedule.rounds).map((round) => (
        <Card key={round.roundIndex} title={round.roundIndex === 0 ? "Playoffs" : `Round ${round.roundIndex}`} className="mb-4">
          <div className="space-y-4">
            {round.matchups.map((m) => (
              <div key={m.id} className="rounded-ctl border border-line p-3">
                <div className="mb-2 flex items-center gap-2">
                  <TeamSelect
                    teams={teams}
                    value={m.teamAId}
                    onChange={(teamAId) =>
                      run(() =>
                        api(`/admin/matchups/${m.id}`, {
                          method: "PATCH",
                          body: JSON.stringify({ teamAId, teamBId: m.teamBId }),
                        }),
                      )
                    }
                  />
                  <span className="text-xs font-bold text-ink-muted">vs</span>
                  <TeamSelect
                    teams={teams}
                    value={m.teamBId}
                    onChange={(teamBId) =>
                      run(() =>
                        api(`/admin/matchups/${m.id}`, {
                          method: "PATCH",
                          body: JSON.stringify({ teamAId: m.teamAId, teamBId }),
                        }),
                      )
                    }
                  />
                </div>
                <table className="tbl">
                  <tbody>
                    {m.games.map((g, i) => (
                      <tr key={g.id}>
                        <td>
                          Match {g.roundNo} · Game {i + 1}
                        </td>
                        <td>
                          <Select
                            className="ctl ctl-sm"
                            value={g.courtId ?? ""}
                            onChange={(e) =>
                              run(() =>
                                api(`/admin/games/${g.id}`, {
                                  method: "PATCH",
                                  body: JSON.stringify({ courtId: e.target.value }),
                                }),
                              )
                            }
                          >
                            <option value="" disabled>
                              court…
                            </option>
                            {schedule.courts.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.label}
                              </option>
                            ))}
                          </Select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </>
  );
}

/** Pre-release flag: hides Shop/Inventory from captains/players while admins always see them. */
function ShopVisibilityCard() {
  const { tournaments, activeTournamentId, refresh } = useAuth();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  const active = tournaments.find((t) => t.id === activeTournamentId);
  if (!active) return null;

  async function toggle() {
    if (!active || busy) return;
    setBusy(true);
    try {
      await api("/admin/tournament/shop-visibility", {
        method: "PATCH",
        body: JSON.stringify({ visible: !active.shopVisible }),
      });
      await refresh();
      showToast(
        active.shopVisible ? "Shop hidden from captains/players." : "Shop is now visible to captains/players.",
        "success",
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not update shop visibility", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      className="mb-5"
      title="Shop visibility"
      subtitle="Admins always see the Shop and Inventory — this only affects captains and players."
    >
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={active.shopVisible} disabled={busy} onChange={toggle} />
        <span className="font-semibold">Visible to captains/players</span>
      </label>
    </Card>
  );
}

/** Date/time/address for the potluck question shown on the Potluck page. */
function PotluckSettingsCard() {
  const { showToast } = useToast();
  const [loaded, setLoaded] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const view = await api<PotluckView>("/potluck");
      if (view.settings.eventAt) {
        const d = new Date(view.settings.eventAt);
        setDate(
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
        );
        setTime(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
      } else {
        setDate("");
        setTime("");
      }
      setAddress(view.settings.address ?? "");
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      const eventAt = date && time ? new Date(`${date}T${time}`).toISOString() : null;
      await api("/admin/tournament/potluck", {
        method: "PATCH",
        body: JSON.stringify({ eventAt, address: address.trim() || null }),
      });
      showToast("Potluck details saved.", "success");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not save potluck details", "error");
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return null;

  return (
    <Card className="mb-5" title="Potluck details" subtitle="Shown to everyone on the Potluck page.">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Time">
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
        <Field label="Address">
          <Input placeholder="123 Main St" value={address} maxLength={200} onChange={(e) => setAddress(e.target.value)} />
        </Field>
      </div>
      <div className="mt-3">
        <Button icon="check" disabled={busy} onClick={save}>
          Save potluck details
        </Button>
      </div>
    </Card>
  );
}

function TeamSelect({
  teams,
  value,
  onChange,
}: {
  teams: TeamRef[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <Select className="ctl ctl-sm" value={value} onChange={(e) => onChange(e.target.value)}>
      {teams.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </Select>
  );
}

/* --- Coin & streak rule editor (economy config) ------------------------- */

type CoinField = keyof CoinRule;
const COIN_FIELDS: { key: CoinField; label: string; help: string; required?: boolean }[] = [
  { key: "perWin", label: "Coins per win", required: true, help: "Coins each player on the winning pair earns for a game." },
  { key: "perLoss", label: "Coins per loss", required: true, help: "Coins each player on the losing pair earns for a game." },
  {
    key: "perCloseLoss",
    label: "Coins per close loss",
    help: "Coins for a loss within the close-loss margin — replaces 'Coins per loss' for tight games.",
  },
  {
    key: "closeLossMargin",
    label: "Close-loss margin",
    help: "A loss by this many points or fewer counts as 'close' and pays 'Coins per close loss'.",
  },
  {
    key: "perPointDiff",
    label: "Per point differential",
    help: "Extra coins per point of score margin — added for winners, subtracted for losers.",
  },
  { key: "floor", label: "Floor (min per game)", help: "The fewest coins a player can come away with from one game." },
];

interface TierDraft {
  after: string;
  bonus: string;
}

/** Parse a numeric input; returns undefined for a blank/invalid entry. */
function num(s: string): number | undefined {
  const t = s.trim();
  if (t === "") return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

function RulesCard() {
  const { showToast } = useToast();
  const [coin, setCoin] = useState<Record<CoinField, string> | null>(null);
  const [direction, setDirection] = useState<StreakRule["direction"]>("loss");
  const [tiers, setTiers] = useState<TierDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setError(null);
    try {
      const { rules } = await api<{ rules: EconomyRules }>("/admin/tournament/rules");
      setCoin(
        Object.fromEntries(
          COIN_FIELDS.map((f) => [f.key, rules.coinRule[f.key] === undefined ? "" : String(rules.coinRule[f.key])]),
        ) as Record<CoinField, string>,
      );
      setDirection(rules.streakRule.direction);
      setTiers(rules.streakRule.tiers.map((t) => ({ after: String(t.after), bonus: String(t.bonus) })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load rules");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    if (!coin || busy) return;

    // Required fields must be whole numbers.
    const perWin = num(coin.perWin);
    const perLoss = num(coin.perLoss);
    if (!Number.isInteger(perWin) || !Number.isInteger(perLoss)) {
      showToast("Coins per win and per loss are required whole numbers.", "error");
      return;
    }

    const coinRule: CoinRule = { perWin: perWin!, perLoss: perLoss! };
    for (const f of COIN_FIELDS) {
      if (f.required) continue;
      const v = num(coin[f.key]);
      if (v !== undefined) coinRule[f.key] = v;
    }

    // Only keep fully-filled tiers; sort by threshold for tidiness.
    const parsedTiers = tiers
      .map((t) => ({ after: num(t.after), bonus: num(t.bonus) }))
      .filter((t): t is { after: number; bonus: number } => t.after !== undefined && t.bonus !== undefined)
      .sort((a, b) => a.after - b.after);
    if (parsedTiers.some((t) => !Number.isInteger(t.after) || t.after <= 0 || !Number.isInteger(t.bonus))) {
      showToast("Each streak tier needs a positive whole-number threshold and a whole-number bonus.", "error");
      return;
    }

    const streakRule: StreakRule = { direction, tiers: parsedTiers };

    if (
      !window.confirm(
        "Saving new rules recomputes coins for EVERY result already entered in this tournament. " +
          "Match and streak coins will change to match the new rules (manual adjustments and bounties are kept). Continue?",
      )
    )
      return;

    setBusy(true);
    try {
      await api("/admin/tournament/rules", { method: "PATCH", body: JSON.stringify({ coinRule, streakRule }) });
      showToast("Rules saved — coins recomputed for existing results.", "success");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not save rules", "error");
    } finally {
      setBusy(false);
    }
  }

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!coin) return null;

  return (
    <Card
      title="Coin & streak rules"
      subtitle="How coins are earned in this tournament."
      className="mb-5"
    >
      <Alert tone="warning">
        Saving these rules <strong>recomputes coins for every result already entered</strong> — match and streak coins
        change to match the new rules. Manual adjustments and bounties are kept.
      </Alert>

      <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-muted">Coins per game</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {COIN_FIELDS.map((f) => (
          <Field
            key={f.key}
            label={
              <span className="inline-flex items-center gap-1">
                {f.label}
                <InfoHint text={f.help} />
              </span>
            }
          >
            <Input
              type="number"
              inputMode="numeric"
              placeholder={f.required ? "required" : "optional"}
              value={coin[f.key]}
              onChange={(e) => setCoin({ ...coin, [f.key]: e.target.value })}
            />
          </Field>
        ))}
      </div>

      <h3 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wider text-ink-muted">Streak bonus</h3>
      <div className="grid gap-3 sm:max-w-xs">
        <Field
          label={
            <span className="inline-flex items-center gap-1">
              Direction
              <InfoHint text="Which kind of run earns a bonus: consecutive losses, consecutive wins, or both. A run resets on the opposite result." />
            </span>
          }
        >
          <Select value={direction} onChange={(e) => setDirection(e.target.value as StreakRule["direction"])}>
            <option value="loss">Losing streaks</option>
            <option value="win">Winning streaks</option>
            <option value="both">Both</option>
          </Select>
        </Field>
      </div>

      <div className="mt-3 space-y-2">
        <span className="flex items-center gap-1 text-xs font-bold text-ink-muted">
          Tiers
          <InfoHint text="When a player's run of matchups reaches a tier's threshold, they earn that tier's bonus. Higher tiers pay out as the run grows." />
        </span>
        {tiers.length === 0 && <p className="text-xs text-ink-faint">No tiers — no streak bonuses.</p>}
        {tiers.map((t, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs text-ink-muted">After</span>
            <Input
              type="number"
              inputMode="numeric"
              className="w-20"
              value={t.after}
              onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, after: e.target.value } : x)))}
            />
            <span className="text-xs text-ink-muted">in a row →</span>
            <Input
              type="number"
              inputMode="numeric"
              className="w-24"
              placeholder="bonus"
              value={t.bonus}
              onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, bonus: e.target.value } : x)))}
            />
            <span className="text-xs text-ink-muted">coins</span>
            <Button variant="ghost" size="sm" onClick={() => setTiers(tiers.filter((_, j) => j !== i))}>
              Remove
            </Button>
          </div>
        ))}
        <Button variant="secondary" size="sm" icon="plus" onClick={() => setTiers([...tiers, { after: "", bonus: "" }])}>
          Add tier
        </Button>
      </div>

      <div className="mt-5">
        <Button icon="check" disabled={busy} onClick={save}>
          Save rules
        </Button>
      </div>
    </Card>
  );
}
