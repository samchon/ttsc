import { LINUX_WATCH_HELPER } from "./LINUX_WATCH_HELPER";
import { syncLinuxWatchHelper } from "./syncLinuxWatchHelper";

/**
 * The drain of a tracker whose watches live in the Linux watch helper: a sync
 * round-trip, resolving whether it proved every earlier event arrived
 * (samchon/ttsc#1426).
 *
 * With no helper running, the tracker's watches have ended with it, so there is
 * nothing the drain could prove.
 */
export function drainLinuxWatchHelper(): Promise<boolean> {
  const helper = LINUX_WATCH_HELPER.current;
  return helper === undefined
    ? Promise.resolve(false)
    : syncLinuxWatchHelper(helper);
}
