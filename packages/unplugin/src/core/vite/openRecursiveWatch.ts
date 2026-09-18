import fs from "node:fs";

import { openLinuxDirectoryObserver } from "../transform/tracker/linux/openLinuxDirectoryObserver";

/**
 * Open the in-process recursive observer for one Vite serve scope, on a
 * platform whose scopes are not brokered: Windows and macOS open theirs in the
 * isolated watch broker instead (`openIsolatedRecursiveWatch`).
 *
 * Non-persistent, so it never keeps a dev server process alive by itself.
 * Errors are reported to `onError`, which moves the scope's entries to the
 * bounded fallback poll instead of losing them.
 *
 * Where Node has no native recursive notification, its `recursive` option walks
 * the whole tree and watches every file, `node_modules` included. There the
 * scope opens the directory-level observer instead, which watches only the
 * directories `admit` accepts and those its handle's `track` names
 * (samchon/ttsc#1389).
 */
export function openRecursiveWatch(
  root: string,
  listener: (eventType: string, file: string | null) => void,
  onError: () => void,
  admit: (directory: string) => boolean = () => true,
): { close(): void; track?(file: string, subtree?: boolean): void } {
  if (process.platform !== "darwin" && process.platform !== "win32") {
    return openLinuxDirectoryObserver(root, admit, listener, onError);
  }
  const watcher = fs.watch(
    root,
    { persistent: false, recursive: true },
    (eventType, file) =>
      listener(eventType, file === null ? null : String(file)),
  );
  watcher.on("error", onError);
  return { close: () => watcher.close() };
}
