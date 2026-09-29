import { LINUX_WATCH_HELPER } from "./LINUX_WATCH_HELPER";
import { syncLinuxWatchHelper } from "./syncLinuxWatchHelper";

/**
 * The drain of a tracker whose watches live in the Linux watch helper: a sync
 * round-trip, resolving whether it proved every earlier event arrived
 * (samchon/ttsc#1426).
 *
 * With no helper running, the tracker's watches have ended with it, so there is
 * nothing the drain could prove.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Only a current helper can acknowledge its ordered event queue; absence
 *   resolves false because ended watches cannot certify a generation.
 * @evidence contracts/common.md#clear-and-simple-design
 *   This adapter selects the current helper and delegates sync ownership.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Missing native coverage is not replaced with a successful local-loop delay.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain sync authority and the absent-helper result,
 *   following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   OS-neutral tracker drainage invokes the explicit helper boundary; it does
 *   not assume another platform's event-loop barrier applies to inotify.
 */
export function drainLinuxWatchHelper(): Promise<boolean> {
  const helper = LINUX_WATCH_HELPER.current;
  return helper === undefined
    ? Promise.resolve(false)
    : syncLinuxWatchHelper(helper);
}
