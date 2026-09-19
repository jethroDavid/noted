import { ClassicFridge } from "./classic";
import { RetroFridge } from "./retro";
import { DuoFridge } from "./duo";

// All models share the scene's 7:10 frame and the same usable note surface.
export const FRIDGE_MODELS = {
  classic: {
    name: "Sage classic",
    description: "Familiar & a little nostalgic",
    Model: ClassicFridge,
  },
  retro: {
    name: "Butter retro",
    description: "Soft curves, sunny mornings",
    Model: RetroFridge,
  },
  duo: {
    name: "Blue duo",
    description: "Clean lines, double doors",
    Model: DuoFridge,
  },
} as const;

export type FridgeModelId = keyof typeof FRIDGE_MODELS;
export const DEFAULT_FRIDGE_MODEL: FridgeModelId = "classic";
export const FRIDGE_MODEL_IDS = Object.keys(FRIDGE_MODELS) as FridgeModelId[];
