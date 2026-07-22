import type { Metadata } from 'next'
import { InspectorProvider } from '../components/inspector-provider'
import { ThemeProvider } from '../components/theme-provider'
import './globals.css'

export const metadata: Metadata = {
  title: 'Immersive Full-Screen — Neon Field',
  description:
    'Square-framed neon waveform fabric: dense horizontal luminous curves in cyan, magenta, violet, coral, and gold with mouse-driven gravity waves.',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="template-immersive-full-screen">
        <InspectorProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </InspectorProvider>
      </body>
    </html>
  )
}
