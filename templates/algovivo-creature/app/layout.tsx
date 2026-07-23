import type { Metadata } from 'next'

import { InspectorProvider } from '../components/inspector-provider'
import { ThemeProvider } from '../components/theme-provider'
import './globals.css'

export const metadata: Metadata = {
  title: 'Algovivo Yellow Cat',
  description:
    '2D yellow soft-body cat with blue neon edges, red strap actuators, and natural locomotion powered by algovivo.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="template-algovivo-creature">
        <InspectorProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </InspectorProvider>
      </body>
    </html>
  )
}
