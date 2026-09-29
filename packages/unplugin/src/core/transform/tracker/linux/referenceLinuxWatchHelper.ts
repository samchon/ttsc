import type { Socket } from "node:net";

import type { LinuxWatchHelper } from "./LinuxWatchHelper";

/**
 * Count one reply the Linux watch helper owes, or one it paid, and keep its
 * output referenced exactly while any is owed (samchon/ttsc#1426).
 *
 * The helper is unreferenced between requests so it never keeps a host alive. A
 * reply is the only thing a waiting registration or drain can be released by,
 * so while one is owed the helper must keep the loop from emptying.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Outstanding reply counts determine loop ownership, not the number of quiet
 *   directory subscriptions; zero-to-nonzero transitions reference both channels.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One counter transition owns child and output references so request owners
 *   cannot apply inconsistent liveness policies independently.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Referencing follows actual outstanding requests rather than a guessed delay
 *   or permanent keepalive that hides missing completion.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain the reply-count authority and exit-liveness reason
 *   under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   OS-neutral request ownership uses supported child and stream ref operations;
 *   optional methods accommodate transport implementations without patching them.
 * @evidence contracts/performance.md#efficient-algorithms
 *   One arithmetic update and boundary checks use constant work per transition.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   All subscription and sync owners share one helper counter; non-boundary
 *   transitions avoid repeating ref or unref effects on the same channel.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   Outstanding replies keep the process and output referenced; the final
 *   release unrefs them. Request owners must balance additions and removals.
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
