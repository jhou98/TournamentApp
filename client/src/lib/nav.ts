import type { IconName } from "../components/Icon";

export type Role = "admin" | "captain" | "player";

export interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  /** Only these roles see the item (default: everyone signed in). */
  roles?: Role[];
  /** Renders muted + non-clickable with a "Soon" pill until the feature ships. */
  comingSoon?: boolean;
  /** Short note shown on the placeholder page (which phase / stories deliver it). */
  phase?: string;
}

/**
 * Sidebar navigation. Future-phase items (economy, shop, missions) are declared
 * here already so enabling one later is a one-line change: drop `comingSoon`
 * and point `to` at the real page.
 */
export const NAV: NavItem[] = [
  { to: "/", label: "Home", icon: "home" },
  { to: "/tournament", label: "Tournament Tracker", icon: "trophy" },
  { to: "/captain", label: "Captain Panel", icon: "users", roles: ["captain", "admin"] },
  { to: "/leaderboard", label: "Leaderboard", icon: "chart", comingSoon: true, phase: "Phase 1 · coin economy (US13–US18)" },
  { to: "/shop", label: "Shop", icon: "shop", comingSoon: true, phase: "Phase 2 · power-ups (US19–US22)" },
  { to: "/missions", label: "Missions", icon: "target", comingSoon: true, phase: "Phase 2 · commissioner (US23–US24)" },
  { to: "/admin", label: "Admin Panel", icon: "shield", roles: ["admin"] },
];

export function visibleNav(role: Role): NavItem[] {
  return NAV.filter((item) => !item.roles || item.roles.includes(role));
}
