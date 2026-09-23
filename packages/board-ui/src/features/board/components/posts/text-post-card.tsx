import { PostCard, type PostCardProps } from "../post-card";

export function TextPostCard(props: PostCardProps) {
  return (
    <PostCard {...props} label={props.post.text}>
      <span className="magnet" aria-hidden="true" />
      <span className="post-text">{props.post.text}</span>
    </PostCard>
  );
}
