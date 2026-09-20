import type { Post } from "../state/board";
import type { FridgeAssets } from "../../../types";
import { TextPostModal } from "./modals/text-post-modal";
import { PhotoPostModal } from "./modals/photo-post-modal";
import { VoicePostModal } from "./modals/voice-post-modal";

export type PostModalProps = {
  assets: FridgeAssets;
  post: Post;
  isNew: boolean;
  now: number;
  onClose: () => void;
  onSave: (post: Post) => void;
  onRemove: (id: string) => void;
  onUndo: (id: string) => void;
};

export function PostModal(props: PostModalProps) {
  switch (props.post.kind) {
    case "text":
      return <TextPostModal {...props} />;
    case "photo":
      return <PhotoPostModal {...props} />;
    case "voice":
      return <VoicePostModal {...props} />;
  }
}
