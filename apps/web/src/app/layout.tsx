import type { Metadata } from "next";
import type { ReactNode } from "react";

import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/caveat/latin-500.css";
import "@noted/fridge-ui/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Noted",
  icons: { icon: "/favicon.svg" },
  description: "A shared family fridge for notes, photos, and voice messages.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
