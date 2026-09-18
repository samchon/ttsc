import fs from "node:fs";
import path from "node:path";

import { LINUX_DIRECTORY_WATCHES } from "./LINUX_DIRECTORY_WATCHES";
import type { LinuxDirectoryWatch } from "./LinuxDirectoryWatch";

/**
 * Subscribe to one directory's non-recursive watch, opening it only when no
 * other observer holds it and closing it when the last one leaves.
 *
 * Throws when the watch cannot be opened, for instance once the per-user
 * inotify limit is reached; the caller treats that as a failed tracker, which
 * falls back to snapshot validation.
 */
export function subscribeLinuxDirectoryWatch(
  directory: string,
  listener: (eventType: string, filename: string | null) => void,
  onError: () => void,
): { close(): void } {
  const key = path.resolve(directory);
  let shared = LINUX_DIRECTORY_WATCHES.get(key);
  if (shared === undefined) {
    const listeners: LinuxDirectoryWatch["listeners"] = new Set();
    const errors: LinuxDirectoryWatch["errors"] = new Set();
    const watcher = fs.watch(
      key,
      { persistent: false },
      (eventType, filename) => {
        const name = filename === null ? null : String(filename);
        for (const notify of [...listeners]) notify(eventType, name);
      },
    );
    const opened: LinuxDirectoryWatch = {
      close: () => {
        if (LINUX_DIRECTORY_WATCHES.get(key) === opened) {
          LINUX_DIRECTORY_WATCHES.delete(key);
        }
        watcher.close();
      },
      errors,
      listeners,
    };
    watcher.on("error", () => {
      // The directory was removed or became unreadable; every subscriber
      // hears it once and the shared handle is gone.
      opened.close();
      for (const fail of [...errors]) fail();
      listeners.clear();
      errors.clear();
    });
    LINUX_DIRECTORY_WATCHES.set(key, opened);
    shared = opened;
  }
  const subscribed = shared;
  subscribed.listeners.add(listener);
  subscribed.errors.add(onError);
  let released = false;
  return {
    close: () => {
      if (released) return;
      released = true;
      subscribed.listeners.delete(listener);
      subscribed.errors.delete(onError);
      if (subscribed.listeners.size === 0) subscribed.close();
    },
  };
}
