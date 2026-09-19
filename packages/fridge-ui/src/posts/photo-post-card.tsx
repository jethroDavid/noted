import { PostCard, type PostCardProps } from "../post-card";
import type { FridgeAssets } from "../types";

export function PhotoPostCard({
  photo,
  ...props
}: PostCardProps & { photo: FridgeAssets["samplePhoto"] }) {
  return (
    <PostCard {...props} label="Mountain lake photo">
      <span className="photo-tape" aria-hidden="true" />
      <img
        className="post-photo"
        src={photo.src}
        alt={photo.alt}
        loading="eager"
        decoding="async"
        draggable={false}
      />
      <span className="photo-heart" aria-hidden="true">
        ♡
      </span>
    </PostCard>
  );
}
