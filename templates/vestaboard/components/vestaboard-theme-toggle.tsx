'use client'

import { useThemeMode } from './theme-provider'

export function VestaboardThemeToggle() {
  const { mode, toggleMode } = useThemeMode()
  const nextMode = mode === 'dark' ? 'light' : 'dark'

  return (
    <button
      className="vestaboard-theme-toggle vestaboard-theme-toggle-control"
      data-builder-id="vestaboard-theme-toggle"
      onClick={toggleMode}
      type="button"
      aria-label={`Switch to ${nextMode} mode`}
    >
      {nextMode === 'dark' ? 'Dark mode' : 'Light mode'}
    </button>
  )
}
