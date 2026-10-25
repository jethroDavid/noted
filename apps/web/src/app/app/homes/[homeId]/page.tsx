"use client";

import { HomeScene } from "@noted/experience/src";
import { useRouter } from "next/navigation";
import { use } from "react";

export default function HomeDetailPage({
  params,
}: {
  params: Promise<{ homeId: string }>;
}) {
  const { homeId } = use(params);
  const router = useRouter();
  return <HomeScene homeId={homeId} onBack={() => router.push("/app")} />;
}
