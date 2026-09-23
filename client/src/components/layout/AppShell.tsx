import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { visibleNav } from "../../lib/nav";
import { Icon, Shuttle } from "../Icon";
import { Avatar, Pill, StatusPill, cx } from "../ui";

/**
 * Authenticated app frame: dark sidebar (brand, nav, tournament switcher, user)
 * + cream content area. Collapses to a top bar with a drawer under `lg`.
 */
export function AppShell() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Close the mobile drawer on navigation.
  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <div className="min-h-screen lg:flex">
      {/* mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-pine px-4 py-3 text-pine-text lg:hidden">
        <div className="flex items-center gap-2">
          <Shuttle size={28} />
          <span className="text-sm font-extrabold text-white">Friendsgiving</span>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="rounded-ctl p-1.5 hover:bg-pine-2"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          <Icon name={open ? "x" : "menu"} size={22} />
        </button>
      </header>

      {/* backdrop */}
      {open && <div className="fixed inset-0 z-30 bg-ink/40 lg:hidden" onClick={() => setOpen(false)} />}

      <Sidebar className={cx(open ? "translate-x-0" : "-translate-x-full", "lg:translate-x-0")} />

      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function Sidebar({ className }: { className?: string }) {
  const { profile, logout, tournaments, activeTournamentId, setActiveTournament } = useAuth();
  if (!profile) return null;
  const active = tournaments.find((t) => t.id === activeTournamentId) ?? null;
  const items = visibleNav(profile.role, active?.shopVisible ?? true);

  return (
    <aside
      className={cx(
        "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-pine text-pine-text transition-transform duration-200",
        "lg:sticky lg:top-0 lg:h-screen lg:shrink-0",
        className,
      )}
    >
      {/* brand */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-5">
        <Shuttle size={40} />
        <div className="leading-tight">
          <div className="text-[15px] font-extrabold text-white">Friendsgiving</div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-pine-muted">Badminton</div>
        </div>
      </div>

      {/* nav */}
      <nav className="flex-1 space-y-0.5 px-3" aria-label="Main">
        {items.map((item) =>
          item.comingSoon ? (
            <div
              key={item.to}
              className="flex cursor-default items-center gap-3 rounded-ctl px-3 py-2 text-sm font-semibold text-pine-muted/70"
              title={`Coming soon — ${item.phase ?? "later phase"}`}
              aria-disabled="true"
            >
              <Icon name={item.icon} size={18} />
              <span className="flex-1">{item.label}</span>
              <Pill tone="dark" className="bg-pine-3 text-pine-muted">
                Soon
              </Pill>
            </div>
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cx(
                  "flex items-center gap-3 rounded-ctl px-3 py-2 text-sm font-semibold transition",
                  isActive ? "bg-pine-2 text-white shadow-inner" : "hover:bg-pine-2/60 hover:text-white",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon name={item.icon} size={18} className={isActive ? "text-amber" : undefined} />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          ),
        )}
      </nav>

      {/* tournament switcher */}
      <div className="px-4 pt-3">
        <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-pine-muted">Tournament</div>
        {tournaments.length > 1 ? (
          <select
            aria-label="Active tournament"
            value={activeTournamentId ?? ""}
            onChange={(e) => setActiveTournament(e.target.value)}
            className="w-full rounded-ctl border border-pine-3 bg-pine-2 px-2.5 py-1.5 text-[13px] font-semibold text-white focus:outline-none focus:ring-2 focus:ring-amber/40"
          >
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        ) : (
          <div className="truncate text-[13px] font-semibold text-white">{active?.name ?? "No tournament"}</div>
        )}
        {active && (
          <div className="mt-1.5">
            <StatusPill status={active.status} />
          </div>
        )}
      </div>

      {/* user */}
      <div className="mt-4 flex items-center gap-3 border-t border-pine-3 px-4 py-4">
        <NavLink to="/profile" className="flex min-w-0 flex-1 items-center gap-3 rounded-ctl hover:text-white">
          <Avatar name={profile.user.displayName} size={34} className="ring-pine" />
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-bold text-white">{profile.user.displayName}</div>
            <div className="text-[11px] capitalize text-pine-muted">{profile.role}</div>
          </div>
        </NavLink>
        <button
          type="button"
          onClick={() => logout()}
          className="rounded-ctl p-1.5 text-pine-muted hover:bg-pine-2 hover:text-white"
          title="Log out"
          aria-label="Log out"
        >
          <Icon name="logout" size={18} />
        </button>
      </div>
    </aside>
  );
}
