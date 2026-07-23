import type { Metadata } from "next";
import { InspectorProvider } from "../components/inspector-provider";
import { ThemeProvider } from "../components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Provoke curiosity.",
  description: "An immersive particle experience.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="template-stay-curious">
        <InspectorProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </InspectorProvider>
      </body>
    </html>
  );
}
