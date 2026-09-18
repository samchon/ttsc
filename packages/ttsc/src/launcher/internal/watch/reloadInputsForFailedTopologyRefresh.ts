import fs from "node:fs";
import path from "node:path";

import { WatchPaths } from "./WatchPaths";

/**
 * The reload inputs to keep watching after a topology refresh failed: the path
 * that triggered the refresh and every declared reload file that is currently
 * missing, so recreating any of them retries the refresh.
 */
export function reloadInputsForFailedTopologyRefresh(
  reloadFiles: Iterable<string>,
  changed?: string,
): string[] {
  const changedKey =
    changed === undefined ? undefined : WatchPaths.pathKey(changed);
  const reloads = new Map<string, string>();
  for (const location of reloadFiles) {
    const resolved = path.resolve(location);
    const key = WatchPaths.pathKey(resolved);
    if (
      (changedKey !== undefined && key === changedKey) ||
      fs.existsSync(resolved) === false
    ) {
      reloads.set(key, resolved);
    }
  }
  return [...reloads.values()].sort();
}
