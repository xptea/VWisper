
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
export function ThemeSwitcher() {
  const { theme, setTheme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return null;
  const current = theme === "system" ? systemTheme : theme;
  return (
    <div className="flex flex-row items-center justify-center gap-2 w-full py-2">
      <button
        title="System Mode"
        className={`rounded-lg p-1.5 hover:bg-sidebar-accent ${theme === "system" ? "bg-sidebar-accent" : ""}`}
        onClick={() => setTheme("system")}
      >
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <rect x="3" y="4" width="18" height="14" rx="2" />
          <path d="M8 20h8" />
          <path d="M12 16v4" />
        </svg>
      </button>
      <button
        title="Dark Mode"
        className={`rounded-lg p-1.5 hover:bg-sidebar-accent ${current === "dark" ? "bg-sidebar-accent" : ""}`}
        onClick={() => setTheme("dark")}
      >
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z" />
        </svg>
      </button>
      <button
        title="Light Mode"
        className={`rounded-lg p-1.5 hover:bg-sidebar-accent ${current === "light" ? "bg-sidebar-accent" : ""}`}
        onClick={() => setTheme("light")}
      >
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v2m0 18v2m11-11h-2M3 12H1m16.95 6.95-1.41-1.41M6.34 6.34 4.93 4.93m12.02 0-1.41 1.41M6.34 17.66l-1.41 1.41" />
        </svg>
      </button>
    </div>
  );
}
