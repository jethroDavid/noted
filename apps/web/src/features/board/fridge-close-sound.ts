"use client";

// A padded seal thump followed by three very quiet, damped glass resonances.
export function playFridgeClose(context: AudioContext): () => void {
  const output = context.createGain();
  output.gain.value = 0.4;
  output.connect(context.destination);
  const now = context.currentTime;
  const sources: OscillatorNode[] = [];
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
    envelope.gain.linearRampToValueAtTime(level, now + delay + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.00001, now + delay + duration);
    source.connect(envelope).connect(output);
    source.start(now + delay);
    source.stop(now + delay + duration + 0.02);
    sources.push(source);
    return source;
  }
  const thump = tone(105, 0, 0.18, 0.13);
  thump.frequency.exponentialRampToValueAtTime(42, now + 0.16);
  for (const [frequency, delay, level] of [
    [1280, 0.06, 0.012],
    [1870, 0.09, 0.006],
    [1430, 0.16, 0.007],
  ] as const) {
    tone(frequency, delay, 0.18, level);
    tone(frequency * 2.37, delay, 0.07, level * 0.2);
  }
  return () => {
    sources.forEach((source) => source.stop());
    output.disconnect();
  };
}
