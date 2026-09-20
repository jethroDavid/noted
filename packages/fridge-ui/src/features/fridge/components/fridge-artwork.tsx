import { useCallback, useState } from "react";
import type { FridgeAssets } from "../../../types";
import { FlatFridge } from "./fridge-flat";

/** Artwork and posts share the stage, so resizing keeps their coordinates aligned. */
export function FridgeArtwork({
  artwork,
}: {
  artwork: FridgeAssets["fridgeArtwork"];
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const source = artwork?.src;
  const checkLoadedImage = useCallback(
    (image: HTMLImageElement | null) => {
      // A server-rendered image can fail before React attaches its error handler.
      if (source && image?.complete && image.naturalWidth === 0) {
        setFailedSource(source);
      }
    },
    [source],
  );

  if (!artwork || failedSource === artwork.src) return <FlatFridge />;

  return (
    <img
      ref={checkLoadedImage}
      className="fridge-artwork"
      src={artwork.src}
      width={1049}
      height={1500}
      alt=""
      aria-hidden="true"
      draggable={false}
      fetchPriority="high"
      onError={() => setFailedSource(artwork.src)}
    />
  );
}
