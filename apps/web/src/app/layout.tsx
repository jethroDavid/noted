import "server-only";
import type { Metadata } from "next";
import localFont from "next/font/local";
import { AuthProvider } from "../platform/auth/auth-provider";
import { TRPCReactProvider } from "../trpc/react";
import "../styles/globals.css";

const handwriting = localFont({
  src: [
    {
      path: "../styles/fonts/Kalam-Regular-latin.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../styles/fonts/Kalam-Bold-latin.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-noted-handwritten",
  display: "swap",
  fallback: ["Segoe Print", "Comic Sans MS", "cursive"],
});

export const metadata: Metadata = {
  title: "Noted",
  description: "Shared family kitchen board",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={handwriting.variable}>
      <body className="font-handwritten">
        <TRPCReactProvider>
          <AuthProvider>{children}</AuthProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
