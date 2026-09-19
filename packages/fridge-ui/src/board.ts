import { REMOVAL_RECOVERY_MS } from "@noted/domain";

// The HTML surface and orthographic scene share a fixed 7 x 10 frame.
// Cover the fridge front, including its upper door. These dimensions match
// .board-surface in styles.css and keep the original card display sizes.
export const BOARD_WIDTH = 540;
export const BOARD_HEIGHT = 870;
export const POST_SIZES = {
  text: { width: 196, height: 190 },
  photo: { width: 202, height: 220 },
  voice: { width: 210, height: 114 },
} as const;

export const PAPER_COLORS = [
  { name: "Butter", value: "#f5dfa0" },
  { name: "Rose", value: "#efcac3" },
  { name: "Lavender", value: "#dcd5ed" },
  { name: "Sage", value: "#d4dfc5" },
  { name: "Cream", value: "#f6f1df" },
] as const;
export const INK_COLORS = [
  { name: "Charcoal", value: "#33352e" },
  { name: "Forest", value: "#344e40" },
  { name: "Berry", value: "#813e4c" },
] as const;

export type PostKind = keyof typeof POST_SIZES;
export type Position = { x: number; y: number };
export type Post = Position & {
  id: string;
  kind: PostKind;
  text: string;
  background: string;
  foreground: string;
  // Creation order is stable. Selection never changes this value.
  order: number;
  removedAt: number | null;
};

export function clampPosition(position: Position, kind: PostKind): Position {
  const size = POST_SIZES[kind];
  const halfX = size.width / BOARD_WIDTH / 2;
  const halfY = size.height / BOARD_HEIGHT / 2;
  return {
    x: Math.min(1 - halfX, Math.max(halfX, position.x)),
    y: Math.min(1 - halfY, Math.max(halfY, position.y)),
  };
}

export function positionFromDrag(
  start: Position,
  delta: Position,
  bounds: { width: number; height: number },
  kind: PostKind,
): Position {
  if (bounds.width <= 0 || bounds.height <= 0) return start;
  return clampPosition(
    {
      x: start.x + delta.x / bounds.width,
      y: start.y + delta.y / bounds.height,
    },
    kind,
  );
}

export function postLayer(
  post: Post,
  selectedId: string | null,
  topOrder: number,
) {
  return post.id === selectedId ? topOrder + 2 : post.order + 1;
}

export function isExpired(post: Post, now: number) {
  return post.removedAt !== null && now >= post.removedAt + REMOVAL_RECOVERY_MS;
}

export function removalMinutes(post: Post, now: number) {
  if (post.removedAt === null) return 0;
  return Math.max(
    0,
    Math.ceil((post.removedAt + REMOVAL_RECOVERY_MS - now) / 60_000),
  );
}

export function createPost(kind: PostKind, order: number): Post {
  return {
    id: crypto.randomUUID(),
    kind,
    order,
    text: "",
    x: 0.5,
    y: 0.58,
    background: PAPER_COLORS[0].value,
    foreground: INK_COLORS[0].value,
    removedAt: null,
  };
}

export const fixturePosts: Post[] = [
  {
    id: "groceries",
    kind: "text",
    text: "Could you grab:\n\nOat milk\nStrawberries\nA little treat ♡",
    x: 0.33,
    y: 0.425,
    background: "#f5dfa0",
    foreground: "#33352e",
    order: 0,
    removedAt: null,
  },
  {
    id: "weekend",
    kind: "photo",
    text: "",
    x: 0.74,
    y: 0.495,
    background: "#f6f1df",
    foreground: "#33352e",
    order: 1,
    removedAt: null,
  },
  {
    id: "dinner",
    kind: "text",
    text: "Sunday dinner\nat ours!\n\n6:30-ish\nCome hungry ♡",
    x: 0.365,
    y: 0.72,
    background: "#dcd5ed",
    foreground: "#33352e",
    order: 2,
    removedAt: null,
  },
  {
    id: "hello",
    kind: "voice",
    text: "",
    x: 0.74,
    y: 0.8,
    background: "#d4dfc5",
    foreground: "#344e40",
    order: 3,
    removedAt: null,
  },
];
