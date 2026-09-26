import type { Metadata } from "next";
import { AuthProvider } from "../platform/auth/auth-provider";
import { TRPCReactProvider } from "../trpc/react";
import "../styles/globals.css";

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
    <html lang="en">
      <body>
        <TRPCReactProvider>
          <AuthProvider>{children}</AuthProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
