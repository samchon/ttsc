"use client";

import { useSyncExternalStore } from "react";

/**
 * Which cell the pointer is on, shared by every view of the same cohort.
 *
 * The bars and the counter table are separate components in separate places on
 * the page, and they describe the same eight cells. A reader hovering a bar is
 * asking about one cell, so the table row for that cell answers the same
 * question and highlights with it, in either direction.
 *
 * A module-level store rather than a context, because the components are
 * mounted independently by MDX and share no parent to hold one.
 */
let hovered: string | null = null;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Null clears it. The run id is the cell's own identity in the aggregate. */
export function setTtscWebsiteBenchmarkEvidenceHover(runId: string | null) {
  if (hovered === runId) return;
  hovered = runId;
  for (const listener of listeners) listener();
}

export default function useTtscWebsiteBenchmarkEvidenceHover(): string | null {
  // The server renders nothing hovered, which is also the first client frame,
  // so the two agree and React does not report a hydration mismatch.
  return useSyncExternalStore(
    subscribe,
    () => hovered,
    () => null,
  );
}
