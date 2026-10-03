"use client";

// Decode before the door moves; loading must never delay the impact cue.
export async function loadFridgeGlass(context: AudioContext) {
  try {
    const response = await fetch("/sound/glass-bottle-rattle.wav");
    if (!response.ok) return null;
    return await context.decodeAudioData(await response.arrayBuffer());
  } catch {
    // The seal thump still works when the optional glass recording fails.
    return null;
  }
}

// A padded seal thump, then a tiny real-glass rattle behind the closed door.
export function playFridgeClose(
  context: AudioContext,
  glass: AudioBuffer | null,
): () => void {
  const output = context.createGain();
  output.gain.value = 0.4;
  output.connect(context.destination);
  const now = context.currentTime;
  const sources: (OscillatorNode | AudioBufferSourceNode)[] = [];
  const nodes: AudioNode[] = [output];
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    sources.forEach((source) => source.stop());
    nodes.forEach((node) => node.disconnect());
  };
  function tone(
    frequency: number,
    delay: number,
    duration: number,
    level: number,
  ) {
    const source = context.createOscillator();
    source.frequency.setValueAtTime(frequency, now + delay);
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0, now + delay);
    envelope.gain.linearRampToValueAtTime(level, now + delay + 0.002);
    envelope.gain.exponentialRampToValueAtTime(0.00001, now + delay + duration);
    source.connect(envelope).connect(output);
    source.start(now + delay);
    source.stop(now + delay + duration + 0.02);
    sources.push(source);
    nodes.push(source, envelope);
    return source;
  }
  const thump = tone(105, 0, 0.18, 0.13);
  thump.frequency.exponentialRampToValueAtTime(42, now + 0.16);
  if (glass) {
    const bottles = context.createBufferSource();
    bottles.buffer = glass;
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 4200;
    const level = context.createGain();
    level.gain.value = 0.018;
    bottles.connect(filter).connect(level).connect(output);
    bottles.onended = stop;
    sources.push(bottles);
    nodes.push(bottles, filter, level);
    bottles.start(now + 0.025);
  } else {
    thump.onended = stop;
  }
  return stop;
}
