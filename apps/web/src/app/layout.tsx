import type { Metadata } from "next";
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
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  );
}
