import type { FridgeAssets } from "@noted/fridge-ui";

export const webFridgeAssets = {
  samplePhoto: {
    src: "/fixtures/lake.jpg",
    alt: "Mountains reflected in a turquoise lake",
  },
  sampleAudio: { src: "/fixtures/dinner.wav" },
  kitchenBackdrop: { src: "/artwork/sunlit-kitchen.webp" },
  fridgeArtwork: { src: "/artwork/cream-fridge.webp" },
  plantArtwork: {
    small: { src: "/artwork/plants/small.webp" },
    growing: { src: "/artwork/plants/growing.webp" },
    lush: { src: "/artwork/plants/lush.webp" },
    overgrown: { src: "/artwork/plants/overgrown.webp" },
  },
} satisfies FridgeAssets;
