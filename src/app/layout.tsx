import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Afterimage",
  description: "A private AI studio for music videos, cover art and cinematic scenes.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
