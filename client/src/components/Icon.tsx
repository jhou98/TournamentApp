import type { SVGProps } from "react";

/** Minimal 24px stroke icon set (no icon library dependency). */
const PATHS = {
  home: "M3 11.5 12 4l9 7.5M5 10v10h5v-6h4v6h5V10",
  trophy: "M8 4h8v5a4 4 0 0 1-8 0V4ZM8 6H5a3 3 0 0 0 3 5M16 6h3a3 3 0 0 1-3 5M12 13v4M8 21h8M10 17h4",
  users: "M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM21 19v-1a4 4 0 0 0-3-3.9M15.5 4.1a3.5 3.5 0 0 1 0 6.8",
  shop: "M4 9h16l-1 11H5L4 9ZM8 9V7a4 4 0 0 1 8 0v2",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 12h.01",
  chart: "M4 20V10M10 20V4M16 20v-8M22 20H2",
  shield: "M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z",
  user: "M20 21v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  logout: "M10 17l5-5-5-5M15 12H3M13 3h6v18h-6",
  bell: "M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2ZM10 20a2 2 0 0 0 4 0",
  chevronDown: "m6 9 6 6 6-6",
  chevronRight: "m9 6 6 6-6 6",
  lock: "M6 11h12v10H6V11ZM8 11V7a4 4 0 0 1 8 0v4",
  unlock: "M6 11h12v10H6V11ZM8 11V7a4 4 0 0 1 7.7-1.5",
  dice: "M4 4h16v16H4V4ZM8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01",
  calendar: "M4 6h16v14H4V6ZM4 10h16M8 3v4M16 3v4",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2",
  check: "m5 12 5 5 9-10",
  x: "M6 6l12 12M18 6 6 18",
  plus: "M12 5v14M5 12h14",
  menu: "M4 7h16M4 12h16M4 17h16",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4",
  flag: "M5 21V4M5 4h12l-2 4 2 4H5",
  bolt: "M13 2 4 14h7l-1 8 9-12h-7l1-8Z",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z",
  layers: "m12 3 9 5-9 5-9-5 9-5ZM3 13l9 5 9-5M3 17l9 5 9-5",
  leaf: "M20 4c-8 0-14 4-15 12 4-5 8-7 12-8-4 3-7 6-8 12 8 0 12-8 11-16Z",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 18,
  className,
  ...rest
}: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/** Brand mark: a shuttlecock in the warm palette. */
export function Shuttle({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true" className={className}>
      <path d="M30 6 42 18 24 34 14 24 30 6Z" fill="#fbf7f2" stroke="#e39a2c" strokeWidth="2" strokeLinejoin="round" />
      <path d="M30 6 42 18M27 10l11 11M24 14l10 10M21 18l8 8" stroke="#e39a2c" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="36" r="7" fill="#c8501b" stroke="#fbf7f2" strokeWidth="2" />
      <path d="M17 31 14 24" stroke="#c8501b" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Maple leaf accent used in page headers. */
export function Leaf({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M12 2 13.8 6.5 17.5 4.6 16.4 8.9 21 9.4 17.8 12.4 21 15.2 16.6 15.6 17.6 20 13.8 17.8 12 22 10.2 17.8 6.4 20 7.4 15.6 3 15.2 6.2 12.4 3 9.4 7.6 8.9 6.5 4.6 10.2 6.5 12 2Z"
        fill="#c8501b"
      />
    </svg>
  );
}
