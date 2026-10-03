"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Receiver = {
  context: AudioContext;
  gain: GainNode;
  hiss: AudioBufferSourceNode;
  hum: OscillatorNode;
};

// Created inside a TV interaction, never during autoplay.
function createReceiver(): Receiver {
  const context = new AudioContext();
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

export function useTvSound(playing: boolean, channel: string | null) {
  const receiver = useRef<Receiver | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [ready, setReady] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  function startReceiver() {
    try {
      receiver.current ??= createReceiver();
      setReady(true);
      void receiver.current.context.resume().catch(() => setUnavailable(true));
    } catch {
      // Native clip audio remains available if Web Audio cannot start.
      setUnavailable(true);
    }
  }
  function unlock() {
    if (enabled || blocked) {
      startReceiver();
      setEnabled(true);
      setBlocked(false);
    }
  }
  function toggle() {
    if (enabled) {
      setEnabled(false);
      setBlocked(false);
    } else {
      startReceiver();
      setEnabled(true);
      setBlocked(false);
    }
  }
  const onAutoplayBlocked = useCallback(() => {
    setEnabled(false);
    setBlocked(true);
  }, []);

  useEffect(() => {
    const audio = receiver.current;
    if (!audio) return;
    const update = () => {
      const audible =
        enabled && playing && document.visibilityState === "visible";
      const now = audio.context.currentTime;
      audio.gain.gain.cancelScheduledValues(now);
      audio.gain.gain.setTargetAtTime(audible ? 0.014 : 0, now, 0.08);
      if (audible)
        void audio.context.resume().catch(() => setUnavailable(true));
      else void audio.context.suspend();
    };
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, [enabled, playing, ready]);

  useEffect(() => {
    const audio = receiver.current;
    if (
      !audio ||
      !enabled ||
      !playing ||
      document.visibilityState !== "visible"
    )
      return;
    const now = audio.context.currentTime;
    audio.gain.gain.cancelScheduledValues(now);
    audio.gain.gain.setValueAtTime(0.04, now);
    audio.gain.gain.exponentialRampToValueAtTime(0.014, now + 0.18);
  }, [channel, enabled, playing]);

  useEffect(
    () => () => {
      const audio = receiver.current;
      audio?.hiss.stop();
      audio?.hum.stop();
      void audio?.context.close();
      receiver.current = null;
    },
    [],
  );

  return { enabled, blocked, unavailable, toggle, unlock, onAutoplayBlocked };
}
