"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useHomeSound } from "../sound/home-sound";

type Receiver = {
  context: AudioContext;
  gain: GainNode;
  hiss: AudioBufferSourceNode;
  hum: OscillatorNode;
};

// The home supplies a gesture-unlocked context; only this scene owns these nodes.
function createReceiver(context: AudioContext): Receiver {
  const gain = context.createGain();
  gain.gain.value = 0;
  gain.connect(context.destination);
  const buffer = context.createBuffer(
    1,
    context.sampleRate * 2,
    context.sampleRate,
  );
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const hiss = context.createBufferSource();
  hiss.buffer = buffer;
  hiss.loop = true;
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1400;
  hiss.connect(filter).connect(gain);
  hiss.start();
  const hum = context.createOscillator();
  hum.frequency.value = 60;
  const humLevel = context.createGain();
  humLevel.gain.value = 0.12;
  hum.connect(humLevel).connect(gain);
  hum.start();
  return { context, gain, hiss, hum };
}

export function useTvSound(idle: boolean) {
  const home = useHomeSound();
  const { context } = home;
  const receiver = useRef<Receiver | null>(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const blocked = autoplayBlocked || (idle && home.enabled && !context);
  const enabled = home.enabled && !blocked;

  useEffect(() => {
    if (!context) return;
    try {
      receiver.current = createReceiver(context);
    } catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Report failure to initialize the external Web Audio receiver.
      setUnavailable(true);
    }
    return () => {
      const audio = receiver.current;
      audio?.hiss.stop();
      audio?.hum.stop();
      audio?.gain.disconnect();
      receiver.current = null;
    };
  }, [context]);
  function unlock() {
    if (home.enabled) {
      home.unlock();
      setAutoplayBlocked(false);
    }
  }
  function toggle() {
    if (enabled) {
      home.setEnabled(false);
      setAutoplayBlocked(false);
    } else {
      home.unlock();
      home.setEnabled(true);
      setAutoplayBlocked(false);
    }
  }
  const onAutoplayBlocked = useCallback(() => {
    setAutoplayBlocked(true);
  }, []);

  useEffect(() => {
    const audio = receiver.current;
    if (!audio) return;
    const update = () => {
      const audible = home.enabled && document.visibilityState === "visible";
      const now = audio.context.currentTime;
      audio.gain.gain.cancelScheduledValues(now);
      // Only channels with no media buzz; clips play their own audio.
      audio.gain.gain.setTargetAtTime(audible && idle ? 0.003 : 0, now, 0.18);
    };
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, [home.enabled, idle, context]);

  return { enabled, blocked, unavailable, toggle, unlock, onAutoplayBlocked };
}
