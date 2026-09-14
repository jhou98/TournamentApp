import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiError, getActiveTournamentId, setActiveTournamentId } from "./api";

export interface SessionUser {
  id: string;
  username: string;
  displayName: string;
  isAdmin: boolean;
}

export interface TournamentSummary {
  id: string;
  name: string;
  status: "setup" | "round_robin" | "playoffs" | "completed";
}

export interface Profile {
  user: SessionUser;
  role: "admin" | "captain" | "player";
  tournamentId: string | null;
  team: { id: string; name: string } | null;
  captain: { id: string; username: string; displayName: string } | null;
}

interface AuthContextValue {
  profile: Profile | null;
  loading: boolean;
  tournaments: TournamentSummary[];
  activeTournamentId: string | null;
  setActiveTournament: (id: string) => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  signup: (input: {
    username: string;
    password: string;
    displayName: string;
    inviteCode?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tournaments, setTournaments] = useState<TournamentSummary[]>([]);
  const [activeTournamentId, setActiveId] = useState<string | null>(getActiveTournamentId());

  /** Load the accessible tournaments, reconcile the active one, then load /me. */
  async function refresh() {
    try {
      const { tournaments: list } = await api<{ tournaments: TournamentSummary[] }>("/tournaments");
      setTournaments(list);

      // Keep a stored selection only if it's still accessible; otherwise fall back
      // to the first tournament (or none). The header must be set before /me.
      let active = getActiveTournamentId();
      if (!active || !list.some((t) => t.id === active)) {
        active = list[0]?.id ?? null;
        setActiveTournamentId(active);
      }
      setActiveId(active);

      setProfile(await api<Profile>("/me"));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setProfile(null);
        setTournaments([]);
      } else {
        throw err;
      }
    }
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  async function setActiveTournament(id: string) {
    setActiveTournamentId(id);
    setActiveId(id);
    // Role/team are per tournament, so re-resolve the profile for the new one.
    setProfile(await api<Profile>("/me"));
  }

  async function login(username: string, password: string) {
    await api("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
    await refresh();
  }

  async function signup(input: {
    username: string;
    password: string;
    displayName: string;
    inviteCode?: string;
  }) {
    await api("/auth/signup", { method: "POST", body: JSON.stringify(input) });
    await refresh();
  }

  async function logout() {
    await api("/auth/logout", { method: "POST" });
    setProfile(null);
    setTournaments([]);
  }

  return (
    <AuthContext.Provider
      value={{
        profile,
        loading,
        tournaments,
        activeTournamentId,
        setActiveTournament,
        login,
        signup,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
