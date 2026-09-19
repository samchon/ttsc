import fs from "node:fs";

import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { openLinuxDirectoryObserver } from "./linux/openLinuxDirectoryObserver";
import { subscribeLinuxDirectoryWatch } from "./linux/subscribeLinuxDirectoryWatch";

/**
 * Open one directory's change notification through the cache-owned watch seam,
 * falling back to the host's own `fs.watch`. Throws exactly where the
 * underlying watch does, so callers classify a registration failure
 * themselves.
 *
 * A recursive watch on a platform without native recursive notification never
 * reaches Node's emulation, which walks the whole tree synchronously and opens
 * one inotify watch per file. It opens the directory-level observer instead,
 * watching only the directories `admit` accepts (samchon/ttsc#1389); without
 * `admit`, every directory below the root is admitted, which only callers whose
 * tree is already bounded may rely on.
 *
 * On Linux every watch, recursive or not, lives in the Linux watch helper,
 * since `fs.watch` there can lose events without notice (samchon/ttsc#1426).
 * Its watches go live asynchronously, so the handle carries `ready`, which
 * resolves whether every watch it opened is live; nothing before that is
 * heard.
 */
export function openDirectoryWatch(
  filesystem: TtscTransformFilesystemOperations,
  directory: string,
  listener: (eventType: string, filename: string | null) => void,
  onError: () => void,
  recursive = false,
  admit?: (directory: string) => boolean,
): { close: () => void; ready?: Promise<boolean> } {
  if (filesystem.watch !== undefined) {
    return filesystem.watch(directory, listener, onError, recursive);
  }
  if (process.platform !== "darwin" && process.platform !== "win32") {
    return recursive
      ? openLinuxDirectoryObserver(
          directory,
          admit ?? (() => true),
          listener,
          onError,
        )
      : subscribeLinuxDirectoryWatch(directory, listener, onError);
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
