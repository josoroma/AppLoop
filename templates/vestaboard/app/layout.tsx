import type { Metadata } from 'next'
import { InspectorProvider } from '../components/inspector-provider'
import { ThemeProvider } from '../components/theme-provider'
import { VestaboardThemeToggle } from '../components/vestaboard-theme-toggle'
import './globals.css'

export const metadata: Metadata = {
  title: 'Vestaboard',
  description: 'A polished, Vestaboard-inspired split-flap message studio.',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="template-vestaboard">
        <InspectorProvider>
          <ThemeProvider>
            {children}
            <VestaboardThemeToggle />
          </ThemeProvider>
        </InspectorProvider>
      </body>
    </html>
  )
}
