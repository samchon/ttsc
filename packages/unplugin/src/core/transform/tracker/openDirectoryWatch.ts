import fs from "node:fs";

import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";

/**
 * Open one directory's change notification through the cache-owned watch seam,
 * falling back to the host's own `fs.watch`. Throws exactly where the
 * underlying watch does, so callers classify a registration failure
 * themselves.
 */
export function openDirectoryWatch(
  filesystem: TtscTransformFilesystemOperations,
  directory: string,
  listener: (eventType: string, filename: string | null) => void,
  onError: () => void,
  recursive = false,
): { close: () => void } {
  if (filesystem.watch !== undefined) {
    return filesystem.watch(directory, listener, onError, recursive);
  }
  const watcher = fs.watch(
    directory,
    { persistent: false, recursive },
    (eventType, filename) =>
      listener(eventType, filename === null ? null : String(filename)),
  );
  watcher.on("error", onError);
  return { close: () => watcher.close() };
}
