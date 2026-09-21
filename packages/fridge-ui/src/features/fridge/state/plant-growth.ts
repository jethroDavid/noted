export const PLANT_STAGES = ["small", "growing", "lush", "overgrown"] as const;
export type PlantStage = (typeof PLANT_STAGES)[number];

export const PLANT_GROWTH_THRESHOLDS = {
  growing: 4,
  lush: 8,
  overgrown: 12,
} as const;

/** One point per newly added post; editing and removal do not affect growth. */
export function getPlantStage(additions: number): PlantStage {
  if (additions >= PLANT_GROWTH_THRESHOLDS.overgrown) return "overgrown";
  if (additions >= PLANT_GROWTH_THRESHOLDS.lush) return "lush";
  if (additions >= PLANT_GROWTH_THRESHOLDS.growing) return "growing";
  return "small";
}
