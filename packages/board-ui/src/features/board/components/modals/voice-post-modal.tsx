import type { PostModalProps } from "../post-modal";
import { Icon } from "../../../../ui/icons";
import { PostModalFrame } from "./post-modal-frame";

export function VoicePostModal(props: PostModalProps) {
  return (
    <PostModalFrame
      {...props}
      title={props.isNew ? "Add a voice note" : "A familiar voice"}
      saveLabel={props.isNew ? "Put on board" : undefined}
      onSubmit={() => props.onSave(props.post)}
    >
      <div className="audio-preview">
        <span className="audio-illustration">
          <Icon name="voice" size={38} />
        </span>
        <p>A little dinner reminder</p>
        <audio controls preload="metadata" src={props.assets.sampleAudio.src}>
          Your browser does not support audio playback.
        </audio>
        <p className="modal-hint">
          Sample audio: “Hey everyone, dinner is at six thirty. See you at
          home!”{props.isNew ? " Recording your own comes later." : ""}
        </p>
      </div>
    </PostModalFrame>
  );
}
