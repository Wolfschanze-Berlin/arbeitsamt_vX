import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/context/theme-context";

export const metadata: Metadata = {
  title: "arbeitsamt_vx",
  description: "Tauri desktop application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
