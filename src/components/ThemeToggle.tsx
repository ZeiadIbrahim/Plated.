"use client";

import { useEffect, useState } from "react";

const THEME_KEY = "plated.theme";

export const ThemeToggle = () => {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    return stored ? stored === "dark" : prefersDark;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    document.documentElement.classList.toggle("theme-dark", isDark);
  }, [isDark]);

  const handleToggle = () => {
    const next = !isDark;
    setIsDark(next);
    if (typeof window !== "undefined") {
      document.documentElement.classList.toggle("theme-dark", next);
      localStorage.setItem(THEME_KEY, next ? "dark" : "light");
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="fixed right-5 top-5 z-30 inline-flex h-10 w-16 items-center justify-center rounded-full border border-black/10 bg-white/80 text-[#111111] shadow-[0_10px_25px_-18px_rgba(0,0,0,0.6)] transition-all duration-300 hover:-translate-y-0.5 hover:border-black/30 hover:bg-white hover:shadow-[0_14px_32px_-18px_rgba(0,0,0,0.65)]"
    >
      <span className="relative flex h-6 w-6 items-center justify-center">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className={`h-5 w-5 transition-all duration-500 ${
            isDark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="M4.9 4.9l1.4 1.4" />
          <path d="M17.7 17.7l1.4 1.4" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="M4.9 19.1l1.4-1.4" />
          <path d="M17.7 6.3l1.4-1.4" />
        </svg>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className={`h-5 w-5 transition-all duration-500 ${
            isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12.5A8.5 8.5 0 1 1 11.5 3a7 7 0 0 0 9.5 9.5Z" />
        </svg>
      </span>
    </button>
  );
};
