import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
