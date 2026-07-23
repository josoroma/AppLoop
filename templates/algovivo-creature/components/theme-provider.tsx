'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

type ThemeMode = 'light' | 'dark'

type ThemeContextValue = {
  mode: ThemeMode
  toggleMode: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

// Neon soft-body template is dark-mode-first.
export function ThemeProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [mode] = useState<ThemeMode>('dark')

  useEffect(() => {
    document.documentElement.classList.add('dark')
  }, [])

  const value = useMemo(
    () => ({
      mode,
      toggleMode: () => {
        // Locked dark for neon stage readability.
      },
    }),
    [mode],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useThemeMode() {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error('useThemeMode must be used inside ThemeProvider.')
  }

  return context
}
