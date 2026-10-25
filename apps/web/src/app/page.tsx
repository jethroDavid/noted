"use client";

import { LoginScreen } from "@noted/experience/src";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

export default function HomePage() {
  const router = useRouter();
  const entered = useCallback(() => router.replace("/app"), [router]);
  return <LoginScreen onEntered={entered} />;
}
