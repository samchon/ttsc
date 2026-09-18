import fs from "node:fs";

/**
 * Open the native recursive observer for one Vite serve scope.
 *
 * Non-persistent, so it never keeps a dev server process alive by itself.
 * Errors are reported to `onError`, which moves the scope's entries to the
 * bounded fallback poll instead of losing them.
 */
export function openRecursiveWatch(
  root: string,
  listener: (eventType: string, file: string | null) => void,
  onError: () => void,
): { close(): void } {
  const watcher = fs.watch(
    root,
    { persistent: false, recursive: true },
    (eventType, file) =>
      listener(eventType, file === null ? null : String(file)),
  );
  watcher.on("error", onError);
  return { close: () => watcher.close() };
}
