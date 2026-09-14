import { Link, useLocation } from "react-router-dom";
import { NAV } from "../lib/nav";
import { Button, EmptyState, PageHeader } from "../components/ui";

/** Placeholder for future-phase routes (economy, shop, missions). */
export function ComingSoon() {
  const { pathname } = useLocation();
  const item = NAV.find((n) => n.to === pathname);
  return (
    <>
      <PageHeader title={item?.label ?? "Coming soon"} subtitle="This part of the tournament isn't built yet." />
      <EmptyState
        icon={item?.icon ?? "bolt"}
        title={`${item?.label ?? "This page"} is coming soon`}
        hint={item?.phase ? `Planned for ${item.phase}.` : "Planned for a later phase."}
        action={
          <Link to="/">
            <Button variant="secondary" icon="home">
              Back to Home
            </Button>
          </Link>
        }
      />
    </>
  );
}
