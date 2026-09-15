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

// Bridge so this non-React module can raise a toast. The ToastProvider registers
// its handler on mount; until then messages are simply dropped.
type ToastTone = "error" | "success" | "info";
type ToastFn = (message: string, tone?: ToastTone) => void;
let toastHandler: ToastFn | null = null;

export function registerToastHandler(fn: ToastFn | null): void {
  toastHandler = fn;
}

// Set by the server when a request looks like a SQL-injection probe. Prisma makes
// the payload harmless, so the request still succeeds — this is just a cheeky
// heads-up we pop as a warning toast.
const NICE_TRY_HEADER = "X-Nice-Try";

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

  const niceTry = res.headers.get(NICE_TRY_HEADER);
  if (niceTry) toastHandler?.(niceTry, "error");

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const err = body?.error;
    throw new ApiError(res.status, err?.code ?? "UNKNOWN", err?.message ?? res.statusText);
  }

  return body as T;
}
