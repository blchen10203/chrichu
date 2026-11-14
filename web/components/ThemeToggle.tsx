"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { flushSync } from "react-dom";
import { browserStorage } from "@/lib/storage";
import { THEME_KEY } from "@/lib/theme";

// Top-right sun/moon. A click grows the new theme out of the button as a circle (View Transitions), or just swaps
// where that is missing or the reader prefers less motion.
export function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(document.documentElement.dataset.theme === "dark");
  }, []);

  function toggle(e: MouseEvent<HTMLButtonElement>) {
    const next = !dark;
    const apply = () => {
      document.documentElement.dataset.theme = next ? "dark" : "light";
      setDark(next);
      try {
        browserStorage()?.setItem(THEME_KEY, next ? "dark" : "light");
      } catch {} // blocked storage: the choice lasts until reload
    };
    if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) return apply();

    const r = e.currentTarget.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const transition = document.startViewTransition(() => flushSync(apply));
    transition.ready.then(() =>
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] },
        { duration: 550, easing: "cubic-bezier(0.65, 0, 0.35, 1)", pseudoElement: "::view-transition-new(root)" },
      ),
    );
  }

  const icon = "absolute inset-0 m-auto motion-safe:transition-[rotate,scale,opacity] motion-safe:duration-500";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark === null ? "Colour theme" : dark ? "Switch to light mode" : "Switch to dark mode"}
      className="absolute top-6 right-3 z-10 flex size-11 items-center justify-center rounded-full text-text active:bg-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
    >
      {/* Moon in light mode, sun in dark: each spins and fades out as the other spins in.
          Drawn only once the theme is known, so a dark page does not spin the moon away on every load. */}
      {dark !== null && (
        <>
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" className={`${icon} ${dark ? "-rotate-90 scale-50 opacity-0" : ""}`}>
            <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
          </svg>
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" className={`${icon} ${dark ? "" : "rotate-90 scale-50 opacity-0"}`}>
            <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.75" />
            <path
              d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
        </>
      )}
    </button>
  );
}
