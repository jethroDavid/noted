"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

const HomeSound = createContext<{
  context: AudioContext | null;
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  unlock: () => void;
} | null>(null);

// One gesture-created context and mute preference survive switches within a home.
export function HomeSoundProvider({ children }: { children: ReactNode }) {
  const audio = useRef<AudioContext | null>(null);
  const [context, setContext] = useState<AudioContext | null>(null);
  const [enabled, setEnabled] = useState(true);
  const unlock = useCallback(() => {
    try {
      if (!audio.current) {
        audio.current = new AudioContext();
        setContext(audio.current);
      }
      if (document.visibilityState === "visible")
        void audio.current.resume().catch(() => {});
    } catch {
      // Visual scenes and native clip playback remain available without Web Audio.
    }
  }, []);
  useEffect(() => {
    const onGesture = (event: Event) => {
      // The TV sound button unlocks in its click handler; unlocking on pointerdown
      // would change a "Tap for sound" toggle's state before its click arrives.
      if ((event.target as Element).closest?.("[data-tv-sound-control]"))
        return;
      if (event.isTrusted && enabled) unlock();
    };
    const onVisibility = () => {
      if (document.visibilityState !== "visible" || !enabled)
        void audio.current?.suspend();
      else void audio.current?.resume().catch(() => {});
    };
    document.addEventListener("pointerdown", onGesture, true);
    document.addEventListener("keydown", onGesture, true);
    document.addEventListener("visibilitychange", onVisibility);
    onVisibility();
    return () => {
      document.removeEventListener("pointerdown", onGesture, true);
      document.removeEventListener("keydown", onGesture, true);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, unlock]);
  useEffect(
    () => () => {
      void audio.current?.close();
      audio.current = null;
    },
    [],
  );
  return (
    <HomeSound value={{ context, enabled, setEnabled, unlock }}>
      {children}
    </HomeSound>
  );
}

export function useHomeSound() {
  const sound = useContext(HomeSound);
  if (!sound) throw new Error("Home sound requires HomeSoundProvider");
  return sound;
}
