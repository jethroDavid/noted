"use client";

import { useSyncExternalStore } from "react";

// True when the page runs inside the native shell's webview. The Capacitor
// bridge is detected structurally so shells need no extra dependency, and
// the check is SSR-safe: no window means not native.
export function isNativeShell(): boolean {
  if (typeof window === "undefined") return false;
  const candidate = window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean };
  };
  return candidate.Capacitor?.isNativePlatform?.() ?? false;
}

function subscribeNative(): () => void {
  // Nativeness never changes within a session; nothing to subscribe to.
  return () => {};
}

const serverNative = () => false;

// Reactive shell detection without a render-cascading effect (mirrors the
// screen-size subscription in features/motion/memory-backdrop.tsx).
export function useNativeShell(): boolean {
  return useSyncExternalStore(subscribeNative, isNativeShell, serverNative);
}
