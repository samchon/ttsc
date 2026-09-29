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
 * @evidence contracts/common.md#principled-implementation
 *   Probe namespace ownership and an ESRCH result authorize stale cleanup;
 *   live or inaccessible process ids must retain their directory.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One directory scan applies namespace and process-liveness checks before
 *   removing an entry; current process cleanup stays with its exit owner.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Cleanup does not treat arbitrary kill errors as death or delete the current
 *   owner's probe namespace to disguise registration failures.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain killed-owner recovery and conservative liveness
 *   conditions under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   OS-neutral cleanup uses node:path and the supported process liveness call;
 *   permission denial remains non-removable rather than an OS-name assumption.
 * @evidence contracts/performance.md#efficient-algorithms
 *   One O(n) entry scan checks only matching probe namespaces, with at most one
 *   process-liveness operation per candidate; no historical global PID scan occurs.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Process liveness and stale-directory deletion are current external effects;
 *   a previous sweep cannot authorize a later owner's cleanup.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   The scan owns only its temporary entry array; confirmed dead-owner probe
 *   directories are retired, while live, denied and uncertain owners remain.
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
    const suffix = entry.slice(WATCH_PROBE_DIRECTORY_PREFIX.length);
    if (!/^[1-9]\d*$/.test(suffix)) continue;
    const owner = Number(suffix);
    if (!Number.isSafeInteger(owner) || owner === process.pid) {
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
