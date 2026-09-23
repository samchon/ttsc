import fs from "node:fs";
import path from "node:path";

import { WATCH_PROBE_DIRECTORY_PREFIX } from "./WATCH_PROBE_DIRECTORY_PREFIX";

/**
 * Remove the probe directories below `parent` whose owning process no longer
 * exists.
 *
 * A process removes its own probe directory when it exits, but a killed process
 * does not. Only a directory named with a process id that the operating system
 * reports as gone (`ESRCH`) is removed: a live owner, one this process may not
 * signal, and a name without an id are left alone.
 *
 * @param parent The tool cache the broker is about to name its own probe
 *   directory in.
 */
export function sweepAbandonedWatchProbes(parent: string): void {
  let entries: string[];
  try {
    entries = fs.readdirSync(parent);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.startsWith(WATCH_PROBE_DIRECTORY_PREFIX)) continue;
    const owner = Number.parseInt(
      entry.slice(WATCH_PROBE_DIRECTORY_PREFIX.length),
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
      // Another process may be removing it at the same moment.
    }
  }
}
