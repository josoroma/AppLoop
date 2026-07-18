"use client";

import { useThemeMode } from "./theme-provider";

export function ThemeToggle() {
  const { mode, toggleMode } = useThemeMode();
  const nextMode = mode === "dark" ? "light" : "dark";

  return (
    <button className="theme-toggle admin-theme-toggle admin-header-theme-toggle" data-builder-id="admin-theme-toggle" onClick={toggleMode} type="button">
      {nextMode === "dark" ? "Dark" : "Light"}
    </button>
  );
}
