"use client";

import { useRef } from "react";

// A retry of an unchanged form reuses its operation. A new draft/gesture
// gets a new identity; device clocks never decide conflict order.
export function useMutationIdentity() {
  const current = useRef<{
    input: string;
    operationId: string;
    postId: string;
  } | null>(null);
  return (input: unknown) => {
    const key = JSON.stringify(input);
    if (!current.current || current.current.input !== key)
      current.current = {
        input: key,
        operationId: crypto.randomUUID(),
        postId: crypto.randomUUID(),
      };
    return current.current;
  };
}
