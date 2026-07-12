import type { Metadata } from "next";
import { BuilderThemeProvider } from "@/components/builder/builder-theme-provider";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

export const metadata: Metadata = {
  title: "AppLoop",
  description: "A local-first visual builder for generated Next.js apps.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <BuilderThemeProvider>
          {children}
          <Toaster />
        </BuilderThemeProvider>
      </body>
    </html>
  );
}