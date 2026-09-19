import fs from "node:fs";
import path from "node:path";

import { WATCH_BRIDGE_DIRECTORY_PREFIX } from "../bridge/WATCH_BRIDGE_DIRECTORY_PREFIX";
import { sweepAbandonedWatchBridges } from "../bridge/sweepAbandonedWatchBridges";

/** Markers already created by this process, by parent directory. */
const MARKERS = new Map<string, string>();

/**
 * Return this process's marker file below `parent`, creating it on first use,
 * for a module whose inputs Turbopack cannot all track (samchon/ttsc#1422).
 *
 * Turbopack persists a loader's result against the dependencies the loader
 * registered, and it cannot track an input outside its project filesystem root.
 * A module that read one therefore also depends on this marker. The marker
 * lives in a directory named after this process and removed when the process
 * exits, the naming the watch bridge uses for its sentinels. A later process
 * finds the marker gone and re-runs the module instead of reusing a result it
 * cannot prove.
 *
 * @param parent The project's own tool cache, inside Turbopack's root.
 */
export function turbopackProcessMarker(parent: string): string {
  const existing = MARKERS.get(parent);
  if (existing !== undefined && fs.existsSync(existing)) return existing;
  fs.mkdirSync(parent, { recursive: true });
  sweepAbandonedWatchBridges(parent);
  const directory = fs.mkdtempSync(
    path.join(parent, `${WATCH_BRIDGE_DIRECTORY_PREFIX}${process.pid}-`),
  );
  const marker = path.join(directory, "untracked-inputs");
  fs.writeFileSync(marker, `${process.pid} ${process.hrtime.bigint()}\n`);
  process.once("exit", () => {
    fs.rmSync(directory, { force: true, recursive: true });
  });
  MARKERS.set(parent, marker);
  return marker;
}
