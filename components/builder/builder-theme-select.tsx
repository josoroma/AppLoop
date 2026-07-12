"use client";

import dynamic from "next/dynamic";
import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Laptop },
];

export const BuilderThemeSelect = dynamic(() => Promise.resolve(BuilderThemeSelectClient), {
  ssr: false,
  loading: () => <BuilderThemeSelectSkeleton />,
});

function BuilderThemeSelectClient() {
  const { setTheme, theme } = useTheme();
  const selectedTheme = theme ?? "system";

  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="sr-only">Builder appearance</span>
      <select
        aria-label="Builder appearance"
        className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        onChange={(event) => setTheme(event.target.value)}
        value={selectedTheme}
      >
        {THEME_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {THEME_OPTIONS.map((option) => {
        const Icon = option.icon;

        return option.value === selectedTheme ? <Icon key={option.value} aria-hidden="true" className="size-4" /> : null;
      })}
    </label>
  );
}

function BuilderThemeSelectSkeleton() {
  return (
    <span className="flex items-center gap-2 text-sm text-muted-foreground" aria-hidden="true">
      <span className="h-10 w-28 rounded-md border bg-background" />
      <Laptop className="size-4" />
    </span>
  );
}