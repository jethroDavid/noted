import type { PostModalProps } from "../post-modal";
import { PostModalFrame } from "./post-modal-frame";

export function PhotoPostModal(props: PostModalProps) {
  return (
    <PostModalFrame
      {...props}
      title={props.isNew ? "Add a photo" : "A moment to keep"}
      saveLabel={props.isNew ? "Put on fridge" : undefined}
      onSubmit={() => props.onSave(props.post)}
    >
      <div className="photo-preview">
        <img
          src={props.assets.samplePhoto.src}
          alt={props.assets.samplePhoto.alt}
        />
      </div>
      {props.isNew && (
        <p className="modal-hint">
          Try this sample photo. Your own photo uploads are coming later.
        </p>
      )}
    </PostModalFrame>
  );
}
