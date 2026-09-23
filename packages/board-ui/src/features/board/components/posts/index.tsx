import type { PostCardProps } from "../post-card";
import type { ThemeAssets } from "../../../../types";
import { TextPostCard } from "./text-post-card";
import { PhotoPostCard } from "./photo-post-card";
import { VoicePostCard } from "./voice-post-card";

export function PostRenderer({
  photo,
  ...props
}: PostCardProps & { photo: ThemeAssets["samplePhoto"] }) {
  switch (props.post.kind) {
    case "text":
      return <TextPostCard {...props} />;
    case "photo":
      return <PhotoPostCard {...props} photo={photo} />;
    case "voice":
      return <VoicePostCard {...props} />;
  }
}
