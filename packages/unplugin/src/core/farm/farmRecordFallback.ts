import path from "node:path";

import { fallbackToolDirectory } from "../bridge/fallbackToolDirectory";

/**
 * The fallback tool directory Farm accepts for a root, or `undefined` when it
 * accepts none (samchon/ttsc#1480).
 *
 * Farm computes every watch file's path relative to its root and fails on one
 * it cannot relate, such as a file on another Windows drive, and its watcher
 * refuses an extra file below any `node_modules` (`hostToolDirectory`). The
 * fallback below this user's temporary directory (`fallbackToolDirectory`)
 * qualifies where it shares the root's drive and lies below no
 * `node_modules`, and Farm's records live below the root alone otherwise.
 *
 * @param root Farm's configured root.
 */
export function farmRecordFallback(root: string): string | undefined {
  const fallback = fallbackToolDirectory(root);
  if (fallback === undefined) return undefined;
  if (path.isAbsolute(path.relative(root, fallback))) return undefined;
  return fallback.split(path.sep).includes("node_modules")
    ? undefined
    : fallback;
}
