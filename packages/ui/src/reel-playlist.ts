"use client";

type PlayableReel = { id: string; status: string; videoUrl: string | null };

export function getNextReelIndex(reels: PlayableReel[], currentId: string) {
  const current = reels.findIndex((reel) => reel.id === currentId);
  for (let step = 1; step <= reels.length; step++) {
    const index = (current + step + reels.length) % reels.length;
    const reel = reels[index];
    if (reel?.status === "ready" && reel.videoUrl) return index;
  }
  return -1;
}
