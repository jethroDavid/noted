import type { ReactNode } from "react";
import { WebHomesShell } from "@/features/homes/web-homes-shell";

export default function HomesLayout({ children }: { children: ReactNode }) {
  return <WebHomesShell>{children}</WebHomesShell>;
}
