import type { Metadata } from "next";
import { InspectorProvider } from "../components/inspector-provider";
import { ThemeProvider } from "../components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Explore the Space-Time Continuum",
  description: "An interactive cinematic 3D Solar System built with Three.js, React Three Fiber, and the shadcn/ui Luma design language.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="template-solar-system">
        <InspectorProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </InspectorProvider>
      </body>
    </html>
  );
}
