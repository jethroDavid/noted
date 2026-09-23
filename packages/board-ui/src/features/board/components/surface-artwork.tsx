import { useCallback, useState } from "react";
import type { ThemeAssets } from "../../../types";
import { FlatBoard } from "./board-flat";

/** Artwork and posts share the stage, so resizing keeps their coordinates aligned. */
export function SurfaceArtwork({
  artwork,
}: {
  artwork: ThemeAssets["surface"];
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

  if (!artwork || failedSource === artwork.src) return <FlatBoard />;

  return (
    <img
      ref={checkLoadedImage}
      className="surface-artwork"
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
