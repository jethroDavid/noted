import type { ReactNode } from "react";

// Skeleton board-art layer: the framed stage every scene renders inside.
// Phase 1 fills it with the kitchen scene and fridge board.
export function BoardStage({ children }: { children: ReactNode }) {
  return (
    <section
      aria-label="Board stage"
      className="flex min-h-screen items-center justify-center bg-slate-100"
    >
      {children}
    </section>
  );
}
