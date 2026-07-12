import type { Metadata } from "next";
import { AdminShell } from "../components/admin-shell";
import { InspectorProvider } from "../components/inspector-provider";
import { ThemeProvider } from "../components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Luma Admin",
  description: "A generated dark-mode admin template managed by AppLoop.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html className="dark" lang="en" suppressHydrationWarning>
      <body>
        <InspectorProvider>
          <ThemeProvider defaultMode="dark">
            <AdminShell>{children}</AdminShell>
          </ThemeProvider>
        </InspectorProvider>
      </body>
    </html>
  );
}