import { PostCard, type PostCardProps } from "../post-card";
import { Waveform } from "../icons";

export function VoicePostCard(props: PostCardProps) {
  return (
    <PostCard {...props} label="Voice message">
      <span className="voice-top">
        <span className="play-symbol" aria-hidden="true">
          ▶
        </span>
        <Waveform />
      </span>
      <span className="voice-label">
        Voice note <span>♫</span>
      </span>
    </PostCard>
  );
}
