import path from "node:path";

import type { CompilerDirectoryWatchEventPlan } from "./CompilerDirectoryWatchEventPlan";
import { WatchPaths } from "./WatchPaths";

/**
 * Plan one compiler-directory event without relying on backend timing.
 *
 * POSIX file watchers own ordinary content changes. A named rename re-arms the
 * replaced file; an unnamed event conservatively re-arms and reports every
 * surviving tracked input below the watch root. Windows has no per-file
 * watchers here, so both named and unnamed directory events report inputs.
 */
export function planCompilerDirectoryWatchEvent(input: {
  changed?: string;
  event: string;
  exists(location: string): boolean;
  location: string;
  platform: NodeJS.Platform;
  trackedFiles: ReadonlyMap<string, string>;
}): CompilerDirectoryWatchEventPlan {
  const candidates =
    input.changed === undefined
      ? [...input.trackedFiles.values()].filter(
          (file) =>
            input.exists(file) &&
            WatchPaths.isPathWithin(input.location, path.resolve(file)),
        )
      : input.trackedFiles.has(
            WatchPaths.pathKeyForPlatform(input.changed, input.platform),
          ) && input.exists(input.changed)
        ? [input.changed]
        : [];
  if (input.changed === undefined) {
    return {
      changes: candidates,
      rearm: input.platform === "win32" ? [] : candidates,
      refresh: true,
    };
  }
  if (candidates.length === 0) {
    return { changes: [], rearm: [], refresh: true };
  }
  if (input.platform === "win32") {
    return { changes: candidates, rearm: [], refresh: false };
  }
  if (input.event === "rename") {
    return { changes: candidates, rearm: candidates, refresh: false };
  }
  return { changes: [], rearm: [], refresh: false };
}
