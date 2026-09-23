import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { PotluckView } from "../lib/types";
import { useToast } from "../components/Toast";
import { Alert, Button, Card, EmptyState, Field, Input, Loading, PageHeader, Segmented } from "../components/ui";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** Potluck RSVP: answer the attendance question, say what you're bringing, and see who else is going. */
export function Potluck() {
  const { activeTournamentId } = useAuth();
  const { showToast } = useToast();
  const [view, setView] = useState<PotluckView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [attending, setAttending] = useState<"yes" | "no" | null>(null);
  const [item, setItem] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    setError(null);
    api<PotluckView>("/potluck")
      .then((v) => {
        setView(v);
        if (v.myRsvp) {
          setAttending(v.myRsvp.attending ? "yes" : "no");
          setItem(v.myRsvp.item ?? "");
        } else {
          setAttending(null);
          setItem("");
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }

  useEffect(() => {
    setView(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTournamentId]);

  const canSave = attending === "no" || (attending === "yes" && item.trim() !== "");

  async function save() {
    if (!canSave || busy || attending === null) return;
    setBusy(true);
    try {
      await api("/potluck/rsvp", {
        method: "POST",
        body: JSON.stringify(attending === "yes" ? { attending: true, item: item.trim() } : { attending: false }),
      });
      showToast("RSVP saved.", "success");
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not save your RSVP", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Potluck" subtitle="Let us know if you're coming and what you're bringing" />

      {error && <Alert tone="error">{error}</Alert>}
      {view === null && !error && <Loading />}

      {view && !view.settings.eventAt && (
        <EmptyState icon="calendar" title="Potluck details coming soon" hint="The admin hasn't set the date, time and address yet." />
      )}

      {view && view.settings.eventAt && (
        <>
          <Card className="mb-5" title="Will you be there?">
            <p className="mb-3 text-sm font-semibold">
              Will you be attending the potluck on {formatDate(view.settings.eventAt)} at {formatTime(view.settings.eventAt)}
              {view.settings.address ? <> at {view.settings.address}</> : null}?
            </p>

            <Segmented
              value={attending ?? ""}
              options={[
                { value: "yes", label: "Yes, I'll be there" },
                { value: "no", label: "No, can't make it" },
              ]}
              onChange={(v) => setAttending(v as "yes" | "no")}
            />

            {attending === "yes" && (
              <Field className="mt-3 max-w-sm" label="What are you bringing?">
                <Input
                  placeholder="e.g. Mac and cheese"
                  value={item}
                  maxLength={120}
                  onChange={(e) => setItem(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && save()}
                />
              </Field>
            )}

            <div className="mt-4">
              <Button icon="check" disabled={!canSave || busy} onClick={save}>
                Save RSVP
              </Button>
            </div>
          </Card>

          <Card title="Who's going" subtitle="Everyone who said they're attending, and what they're bringing.">
            {view.attendees.length === 0 ? (
              <EmptyState icon="calendar" title="No RSVPs yet" hint="Be the first to say you're coming." />
            ) : (
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Bringing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.attendees.map((a, i) => (
                      <tr key={`${a.displayName}-${i}`}>
                        <td className="font-semibold">{a.displayName}</td>
                        <td>{a.item}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}
