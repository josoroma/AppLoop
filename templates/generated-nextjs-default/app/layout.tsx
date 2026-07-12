import type { Metadata } from "next";
import { InspectorProvider } from "../components/inspector-provider";
import { SiteHeader } from "../components/site-header";
import { ThemeProvider } from "../components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Generated AppLoop App",
  description: "A generated Next.js app managed by AppLoop.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <InspectorProvider>
          <ThemeProvider>
            <SiteHeader />
            {children}
          </ThemeProvider>
        </InspectorProvider>
      </body>
    </html>
  );
}