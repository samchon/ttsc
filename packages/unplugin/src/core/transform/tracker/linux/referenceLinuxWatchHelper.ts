import type { Socket } from "node:net";

import type { LinuxWatchHelper } from "./LinuxWatchHelper";

/**
 * Count one reply the Linux watch helper owes, or one it paid, and keep its
 * output referenced exactly while any is owed (samchon/ttsc#1426).
 *
 * The helper is unreferenced between requests so it never keeps a host alive. A
 * reply is the only thing a waiting registration or drain can be released by,
 * so while one is owed the helper must keep the loop from emptying.
 */
export function referenceLinuxWatchHelper(
  helper: LinuxWatchHelper,
  delta: 1 | -1,
): void {
  const before = helper.pending;
  helper.pending = Math.max(0, before + delta);
  const output = helper.child.stdout as Socket | null;
  if (before === 0 && helper.pending !== 0) {
    helper.child.ref();
    output?.ref?.();
  } else if (before !== 0 && helper.pending === 0) {
    helper.child.unref();
    output?.unref?.();
  }
}
