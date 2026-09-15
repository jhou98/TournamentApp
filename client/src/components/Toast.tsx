import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { registerToastHandler } from "../lib/api";
import { Icon } from "./Icon";
import { cx } from "./ui";

export type ToastTone = "error" | "success" | "info";

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastApi {
  /** Show a transient popup. Errors linger a little longer than confirmations. */
  showToast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const TONE_CLS: Record<ToastTone, string> = {
  error: "border-danger/30 bg-danger-soft text-danger-ink",
  success: "border-success/30 bg-success-soft text-success-ink",
  info: "border-info/30 bg-info-soft text-info-ink",
};

const TONE_ICON: Record<ToastTone, "x" | "check" | "bell"> = {
  error: "x",
  success: "check",
  info: "bell",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, tone: ToastTone = "info") => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, message, tone }]);
      // Errors stay a touch longer so they can be read before vanishing.
      window.setTimeout(() => dismiss(id), tone === "error" ? 6000 : 3500);
    },
    [dismiss],
  );

  const api = useMemo(() => ({ showToast }), [showToast]);

  // Let the API layer (a non-React module) raise toasts, e.g. the SQL-injection
  // "nice try" heads-up carried on a response header.
  useEffect(() => {
    registerToastHandler(showToast);
    return () => registerToastHandler(null);
  }, [showToast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={cx(
              "pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-ctl border px-3 py-2 text-sm shadow-card",
              "animate-[toast-in_150ms_ease-out]",
              TONE_CLS[t.tone],
            )}
          >
            <Icon name={TONE_ICON[t.tone]} size={15} className="mt-0.5 shrink-0" />
            <span className="flex-1">{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="shrink-0 opacity-60 hover:opacity-100"
              aria-label="Dismiss"
            >
              <Icon name="x" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
