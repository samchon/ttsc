import fs from "node:fs";
import path from "node:path";

import { WATCH_BRIDGE_DIRECTORY_PREFIX } from "./WATCH_BRIDGE_DIRECTORY_PREFIX";

/**
 * Remove the per-process directories below `parent` whose owning process no
 * longer exists.
 *
 * A process removes its own directory when it exits, the broker's probes' among
 * them, but a killed process does not. The project records live beside these
 * under a stable name and are never swept. Only a directory named with a
 * process id that the operating system reports as gone (`ESRCH`) is removed: a
 * live owner, one this process may not signal, and a name without an id are
 * left alone.
 *
 * @param parent The directory the bridge is about to create its own in.
 */
export function sweepAbandonedWatchBridges(parent: string): void {
  let entries: string[];
  try {
    entries = fs.readdirSync(parent);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.startsWith(WATCH_BRIDGE_DIRECTORY_PREFIX)) continue;
    const owner = Number.parseInt(
      entry.slice(WATCH_BRIDGE_DIRECTORY_PREFIX.length),
      10,
    );
    if (!Number.isInteger(owner) || owner <= 0 || owner === process.pid) {
      continue;
    }
    try {
      process.kill(owner, 0);
      continue;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") continue;
    }
    try {
      fs.rmSync(path.join(parent, entry), { force: true, recursive: true });
    } catch {
      // Another bridge may be removing it at the same moment.
    }
  }
}
