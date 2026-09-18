import path from "node:path";

import type { ITsconfigSourceSnapshotEntry } from "./ITsconfigSourceSnapshotEntry";
import { collectTsconfigSourceSnapshot } from "./collectTsconfigSourceSnapshot";

/**
 * Capture the leaf config and its complete `extends` graph in one deterministic
 * list.
 *
 * Transform wrappers derive configuration before the compiler reads it again.
 * Comparing this snapshot across the compile prevents a wrapper derived from
 * one config state from being paired with membership and output from another.
 */
export function readTsconfigSourceSnapshot(
  tsconfig: string,
): ITsconfigSourceSnapshotEntry[] {
  const output = new Map<string, string | null>();
  collectTsconfigSourceSnapshot(path.resolve(tsconfig), new Set(), output);
  return [...output.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([source, contents]) => ({ contents, path: source }));
}
