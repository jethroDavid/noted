"use client";

import { HomesScreen } from "@noted/experience/src";
import { useRouter } from "next/navigation";

export default function HomesPage() {
  const router = useRouter();
  return <HomesScreen onNavigate={(href) => router.push(href)} />;
}
