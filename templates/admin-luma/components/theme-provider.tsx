"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type ThemeMode = "light" | "dark";

type ThemeContextValue = {
  mode: ThemeMode;
  toggleMode: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children, defaultMode = "dark" }: Readonly<{ children: ReactNode; defaultMode?: ThemeMode }>) {
  const [mode, setMode] = useState<ThemeMode>(defaultMode);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const storedMode = window.localStorage.getItem("apploop-admin-theme");
      setMode(storedMode === "dark" || storedMode === "light" ? storedMode : defaultMode);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [defaultMode]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", mode === "dark");
    window.localStorage.setItem("apploop-admin-theme", mode);
  }, [mode]);

  const value = useMemo(
    () => ({
      mode,
      toggleMode: () => setMode((currentMode) => (currentMode === "dark" ? "light" : "dark")),
    }),
    [mode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeMode() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useThemeMode must be used inside ThemeProvider.");
  }

  return context;
}