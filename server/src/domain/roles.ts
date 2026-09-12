import type { MembershipRole } from "../ports/index.js";

export type AppRole = "admin" | "captain" | "player";

/** The three product roles (US1) derived from admin flag + membership role. */
export function deriveRole(isAdmin: boolean, membershipRole: MembershipRole | null): AppRole {
  if (isAdmin) return "admin";
  if (membershipRole === "captain") return "captain";
  return "player";
}
