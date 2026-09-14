import type { ReactNode } from "react";
import { Leaf, Shuttle } from "../Icon";

/**
 * Full-screen shell for the auth pages (login / signup). Desktop shows a
 * warm dark hero panel on the left; mobile collapses that into a compact
 * dark header bar above the form.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen lg:flex">
      {/* mobile header (replaces the hero panel below lg) */}
      <header className="flex items-center justify-center gap-2 bg-pine px-4 py-4 text-pine-text lg:hidden">
        <Shuttle size={28} />
        <span className="text-sm font-extrabold text-white">Friendsgiving Badminton</span>
      </header>

      {/* hero panel */}
      <div className="hero-dark relative hidden overflow-hidden lg:flex lg:w-[45%] lg:shrink-0 lg:flex-col lg:items-center lg:justify-center">
        <Shuttle
          size={440}
          className="pointer-events-none absolute -right-28 -top-20 rotate-12 opacity-10"
        />
        <div className="relative z-10 flex flex-col items-center px-10 text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-amber">Friends</span>
          <h1 className="mt-3 text-5xl font-extrabold uppercase leading-tight text-white sm:text-6xl">
            Thanksgiving
          </h1>
          <div className="text-4xl font-extrabold uppercase leading-tight text-pine-text sm:text-5xl">
            Tournament
          </div>
          <p className="mt-5 text-sm text-pine-muted">Good Friends &middot; Great Games &middot; Happy Thanksgiving</p>
        </div>
      </div>

      {/* form panel */}
      <div className="flex flex-1 items-center justify-center bg-cream px-4 py-10 sm:px-6">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex justify-center">
            <Leaf size={32} />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
