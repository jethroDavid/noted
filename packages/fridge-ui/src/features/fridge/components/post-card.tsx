import {
  useRef,
  type CSSProperties,
  type ReactNode,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  POST_SIZES,
  clampPosition,
  positionFromDrag,
  postLayer,
  type Post,
  type Position,
} from "../state/board";

export type PostCardProps = {
  post: Post;
  selectedId: string | null;
  topOrder: number;
  select: (id: string | null) => void;
  move: (id: string, position: Position) => void;
  open: (post: Post) => void;
  /** Connected fridges preview moves locally and commit on release. */
  commitMove?: (id: string) => void;
  cancelMove?: (id: string) => void;
};

export function PostCard({
  children,
  label,
  post,
  selectedId,
  topOrder,
  select,
  move,
  open,
  commitMove,
  cancelMove,
}: PostCardProps & { children: ReactNode; label: string }) {
  const drag = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
    start: Position;
    bounds: DOMRect;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const pending = post.removedAt !== null;
  const size = POST_SIZES[post.kind];
  // Also contain positions created before the artwork's safe bounds changed.
  const position = clampPosition(post, post.kind);

  function pointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    select(post.id);
    suppressClick.current = false;
    if (pending) return;
    const surface = event.currentTarget.parentElement;
    if (!surface) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      start: position,
      bounds: surface.getBoundingClientRect(),
      moved: false,
    };
  }

  function pointerMove(event: PointerEvent<HTMLButtonElement>) {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const delta = {
      x: event.clientX - active.clientX,
      y: event.clientY - active.clientY,
    };
    if (!active.moved && Math.hypot(delta.x, delta.y) < 6) return;
    active.moved = true;
    suppressClick.current = true;
    move(
      post.id,
      positionFromDrag(active.start, delta, active.bounds, post.kind),
    );
  }

  function endDrag(event: PointerEvent<HTMLButtonElement>, canceled = false) {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    if (canceled) {
      if (cancelMove) cancelMove(post.id);
      else move(post.id, active.start);
      suppressClick.current = true;
    } else if (active.moved) {
      commitMove?.(post.id);
    }
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function keyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape") {
      select(null);
      return;
    }
    const directions: Record<string, Position> = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
    };
    const direction = directions[event.key];
    if (!direction || pending) return;
    event.preventDefault();
    const step = event.shiftKey ? 0.05 : 0.01;
    select(post.id);
    move(
      post.id,
      clampPosition(
        {
          x: position.x + direction.x * step,
          y: position.y + direction.y * step,
        },
        post.kind,
      ),
    );
    commitMove?.(post.id);
  }

  return (
    <button
      className={`post post--${post.kind}${pending ? " post--pending" : ""}${selectedId === post.id ? " post--selected" : ""}`}
      data-post-id={post.id}
      data-order={post.order}
      data-x={position.x}
      data-y={position.y}
      style={
        {
          left: `${position.x * 100}%`,
          top: `${position.y * 100}%`,
          width: `${(size.width / BOARD_WIDTH) * 100}%`,
          height: `${(size.height / BOARD_HEIGHT) * 100}%`,
          backgroundColor: post.background,
          color: post.foreground,
          zIndex: postLayer(post, selectedId, topOrder),
        } as CSSProperties
      }
      aria-label={`${pending ? "Undo removal of" : "Open"} ${label}`}
      aria-describedby="board-instructions"
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={(event) => endDrag(event)}
      onPointerCancel={(event) => endDrag(event, true)}
      onLostPointerCapture={(event) => endDrag(event, true)}
      onKeyDown={keyDown}
      onClick={(event) => {
        if (suppressClick.current && event.detail !== 0) {
          suppressClick.current = false;
          return;
        }
        select(post.id);
        open(post);
      }}
    >
      {children}
      {pending && <span className="pending-label">Removal pending · Undo</span>}
    </button>
  );
}
