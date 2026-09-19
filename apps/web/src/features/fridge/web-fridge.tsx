import { FridgeApp, type FridgeAssets } from "@noted/fridge-ui";

const webAssets = {
  samplePhoto: {
    src: "/fixtures/lake.jpg",
    alt: "Mountains reflected in a turquoise lake",
  },
  sampleAudio: {
    src: "/fixtures/dinner.wav",
  },
} satisfies FridgeAssets;

export function WebFridge() {
  return <FridgeApp assets={webAssets} />;
}
