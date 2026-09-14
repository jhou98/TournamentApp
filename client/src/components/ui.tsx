import { type ButtonHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type InputHTMLAttributes } from "react";
import { NavLink } from "react-router-dom";
import { Icon, Leaf, type IconName } from "./Icon";

/* ------------------------------------------------------------------------ */
/* Shared UI primitives. Every page composes these so the visual language    */
/* (warm palette, radii, pills, tables) stays consistent across phases.      */
/* ------------------------------------------------------------------------ */

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/* --- Buttons ------------------------------------------------------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "dark";
type ButtonSize = "sm" | "md";

const BTN_VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand-hover shadow-sm",
  secondary: "bg-surface text-ink border border-line hover:bg-sand",
  ghost: "text-ink-muted hover:bg-sand hover:text-ink",
  danger: "bg-danger-soft text-danger-ink hover:bg-danger hover:text-white",
  dark: "bg-pine text-white hover:bg-pine-2",
};
const BTN_SIZE: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  icon,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
}) {
  return (
    <button
      type="button"
      className={cx(
        "inline-flex items-center justify-center rounded-ctl font-semibold whitespace-nowrap transition",
        "disabled:cursor-not-allowed disabled:opacity-50",
        BTN_VARIANT[variant],
        BTN_SIZE[size],
        className,
      )}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === "sm" ? 15 : 17} />}
      {children}
    </button>
  );
}

/* --- Cards --------------------------------------------------------------- */

export function Card({
  title,
  subtitle,
  action,
  className,
  bodyClassName,
  children,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <section className={cx("rounded-card border border-line bg-surface shadow-card", className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
          <div>
            {title && <h2 className="text-[15px] font-bold">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={cx(title || action ? "px-5 pb-5" : "p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

/* --- Pills --------------------------------------------------------------- */

export type PillTone = "neutral" | "success" | "warning" | "danger" | "info" | "brand" | "dark";

const PILL_TONE: Record<PillTone, string> = {
  neutral: "bg-sand text-ink-muted",
  success: "bg-success-soft text-success-ink",
  warning: "bg-amber-soft text-amber-ink",
  danger: "bg-danger-soft text-danger-ink",
  info: "bg-info-soft text-info-ink",
  brand: "bg-brand-soft text-brand-ink",
  dark: "bg-pine text-pine-text",
};

export function Pill({
  tone = "neutral",
  icon,
  className,
  children,
}: {
  tone?: PillTone;
  icon?: IconName;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap",
        PILL_TONE[tone],
        className,
      )}
    >
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  );
}

/** Map the server's matchup / game / tournament status strings to a pill. */
export function StatusPill({ status, label }: { status: string; label?: string }) {
  const map: Record<string, { tone: PillTone; text: string }> = {
    scheduled: { tone: "neutral", text: "Scheduled" },
    pending: { tone: "neutral", text: "Pending" },
    in_progress: { tone: "warning", text: "In progress" },
    final: { tone: "success", text: "Completed" },
    completed: { tone: "success", text: "Completed" },
    awaiting_lineups: { tone: "neutral", text: "Awaiting lineups" },
    assigned: { tone: "info", text: "Assigned" },
    setup: { tone: "neutral", text: "Setup" },
    round_robin: { tone: "brand", text: "Round robin" },
    playoffs: { tone: "warning", text: "Playoffs" },
    tie: { tone: "info", text: "Tie" },
  };
  const m = map[status] ?? { tone: "neutral" as PillTone, text: status.replace(/_/g, " ") };
  return <Pill tone={m.tone}>{label ?? m.text}</Pill>;
}

/* --- Page header --------------------------------------------------------- */

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <Leaf className="mt-1 shrink-0" />
        <div>
          <h1 className="text-[22px] leading-tight">{title}</h1>
          {subtitle && <p className="mt-0.5 text-[13px] text-ink-muted">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/* --- Tabs ---------------------------------------------------------------- */

export interface TabDef {
  to: string;
  label: string;
  end?: boolean;
}

/** Route-driven tabs (each tab is a NavLink under a hub page). */
export function Tabs({ tabs, className }: { tabs: TabDef[]; className?: string }) {
  return (
    <nav className={cx("mb-5 flex gap-1 overflow-x-auto border-b border-line", className)} aria-label="Sections">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) =>
            cx(
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold transition",
              isActive
                ? "border-brand text-brand"
                : "border-transparent text-ink-muted hover:border-line-strong hover:text-ink",
            )
          }
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}

/** State-driven segmented control (for in-page filters like Daily / Weekly). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-ctl bg-sand p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            "rounded-[7px] px-3 py-1 text-[13px] font-semibold transition",
            o.value === value ? "bg-brand text-white shadow-sm" : "text-ink-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* --- Forms --------------------------------------------------------------- */

export function Field({
  label,
  hint,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1 block text-xs font-bold text-ink-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-faint">{hint}</span>}
    </label>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx("ctl", className)} {...rest} />;
}

export function Select({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx("ctl", className)} {...rest} />;
}

/* --- Feedback ------------------------------------------------------------ */

export function Alert({
  tone,
  children,
  onClose,
}: {
  tone: "error" | "success" | "info";
  children: ReactNode;
  onClose?: () => void;
}) {
  const cls = {
    error: "border-danger/30 bg-danger-soft text-danger-ink",
    success: "border-success/30 bg-success-soft text-success-ink",
    info: "border-info/30 bg-info-soft text-info-ink",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx("mb-4 flex items-start gap-2 rounded-ctl border px-3 py-2 text-sm", cls)}>
      <span className="flex-1">{children}</span>
      {onClose && (
        <button type="button" onClick={onClose} className="opacity-60 hover:opacity-100" aria-label="Dismiss">
          <Icon name="x" size={14} />
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  icon = "calendar",
  title,
  hint,
  action,
}: {
  icon?: IconName;
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-line-strong bg-surface/60 px-6 py-10 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-brand">
        <Icon name={icon} size={20} />
      </div>
      <p className="font-bold">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-[13px] text-ink-muted">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-10 text-sm text-ink-muted" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line-strong border-t-brand" />
      {label}
    </div>
  );
}

/* --- Identity marks ------------------------------------------------------ */

const TEAM_COLORS = ["#c8501b", "#2f8f5b", "#3b6ea5", "#8a5410", "#7b4ea3", "#b0362f", "#1f7a8c", "#5b6b2a"];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) {
    // Single word: "Team1" → "T1", "Falcons" → "FA".
    const w = parts[0]!;
    const trailingDigits = w.match(/\d+$/)?.[0];
    return (trailingDigits && w.length > trailingDigits.length
      ? w[0]! + trailingDigits.slice(0, 1)
      : w.slice(0, 2)
    ).toUpperCase();
  }
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/** Colored circle keyed off a team name — stable across pages. */
export function TeamMark({ name, size = 28, className }: { name: string; size?: number; className?: string }) {
  const color = TEAM_COLORS[hashStr(name) % TEAM_COLORS.length];
  return (
    <span
      className={cx("inline-flex shrink-0 items-center justify-center rounded-full font-extrabold text-white", className)}
      style={{ width: size, height: size, background: color, fontSize: Math.round(size * 0.38) }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

export function Avatar({ name, size = 32, className }: { name: string; size?: number; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-brand-soft font-bold text-brand-ink ring-2 ring-surface",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

/** Team name with its mark, used in schedules, results and standings. */
export function TeamChip({ name, bold, size = 24 }: { name: string; bold?: boolean; size?: number }) {
  return (
    <span className={cx("inline-flex items-center gap-2", bold && "font-bold")}>
      <TeamMark name={name} size={size} />
      <span className="truncate">{name}</span>
    </span>
  );
}

/* --- Stats --------------------------------------------------------------- */

export function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: IconName;
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 rounded-card border border-line bg-surface p-4 shadow-card">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
        <Icon name={icon} size={20} />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-semibold text-ink-muted">{label}</div>
        <div className="truncate text-xl font-extrabold leading-tight">{value}</div>
        {hint && <div className="truncate text-xs text-ink-faint">{hint}</div>}
      </div>
    </div>
  );
}

/** Left-aligned heading row used inside cards / lists (e.g. "Nov 28, 2024"). */
export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cx("mb-2 text-xs font-bold uppercase tracking-wider text-ink-muted", className)}>{children}</h3>;
}
