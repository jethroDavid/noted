export type FridgeAssets = Readonly<{
  samplePhoto: Readonly<{
    src: string;
    alt: string;
  }>;
  sampleAudio: Readonly<{
    src: string;
  }>;
  kitchenBackdrop?: Readonly<{
    src: string;
  }>;
  fridgeArtwork?: Readonly<{
    src: string;
  }>;
  plantArtwork?: Readonly<Record<PlantStage, Readonly<{ src: string }>>>;
}>;
import type { PlantStage } from "./features/fridge/state/plant-growth";
