"use client";

import { ThemeProvider } from "next-themes";

export function BuilderThemeProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" disableTransitionOnChange enableSystem storageKey="apploop:builder-theme">
      {children}
    </ThemeProvider>
  );
}