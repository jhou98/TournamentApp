import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiError } from "./api";

export interface SessionUser {
  id: string;
  username: string;
  displayName: string;
  isAdmin: boolean;
}

export interface Profile {
  user: SessionUser;
  role: "admin" | "captain" | "player";
  team: { id: string; name: string } | null;
  captain: { id: string; username: string; displayName: string } | null;
}

interface AuthContextValue {
  profile: Profile | null;
  loading: boolean;
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

  async function refresh() {
    try {
      setProfile(await api<Profile>("/me"));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setProfile(null);
      } else {
        throw err;
      }
    }
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

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
  }

  return (
    <AuthContext.Provider value={{ profile, loading, login, signup, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
