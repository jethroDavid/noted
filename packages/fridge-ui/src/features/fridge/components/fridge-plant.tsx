import type { FridgeAssets } from "../../../types";
import { PLANT_STAGES, type PlantStage } from "../state/plant-growth";

export function FridgePlant({
  artwork,
  stage,
}: {
  artwork: FridgeAssets["plantArtwork"];
  stage: PlantStage;
}) {
  if (!artwork) return null;

  return (
    <div className="fridge-plant" data-growth-stage={stage} aria-hidden="true">
      {PLANT_STAGES.map((growth) => (
        <img
          key={growth}
          src={artwork[growth].src}
          data-stage={growth}
          data-active={growth === stage}
          width={1049}
          height={1500}
          alt=""
          draggable={false}
          decoding="async"
        />
      ))}
    </div>
  );
}
