export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// The active tournament (US28) travels as a header on every request, backed by
// localStorage so a reload keeps the last selection.
const ACTIVE_TOURNAMENT_KEY = "activeTournamentId";
let activeTournamentId: string | null = readStoredTournamentId();

function readStoredTournamentId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_TOURNAMENT_KEY);
  } catch {
    return null;
  }
}

export function getActiveTournamentId(): string | null {
  return activeTournamentId;
}

export function setActiveTournamentId(id: string | null): void {
  activeTournamentId = id;
  try {
    if (id) localStorage.setItem(ACTIVE_TOURNAMENT_KEY, id);
    else localStorage.removeItem(ACTIVE_TOURNAMENT_KEY);
  } catch {
    // Ignore storage failures (private mode, etc.) — the in-memory value still works.
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(activeTournamentId ? { "X-Tournament-Id": activeTournamentId } : {}),
      ...init?.headers,
    },
    ...init,
  });

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const err = body?.error;
    throw new ApiError(res.status, err?.code ?? "UNKNOWN", err?.message ?? res.statusText);
  }

  return body as T;
}
