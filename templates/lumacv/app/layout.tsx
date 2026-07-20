import type { Metadata } from "next";
import { InspectorProvider } from "../components/inspector-provider";
import { SiteHeader } from "../components/site-header";
import { ThemeProvider } from "../components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "LumaCV — Professional CV",
  description: "Modern CV-focused CV template built with Next.js and shadcn/ui.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="template-lumacv">
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