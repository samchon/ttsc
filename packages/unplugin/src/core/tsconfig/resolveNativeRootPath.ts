import fs from "node:fs";

import { resolveRealPath } from "./resolveRealPath";

/** Native watchers expand Windows short names that regular realpath retains. */
export function resolveNativeRootPath(location: string): string {
  try {
    return fs.realpathSync.native(location);
  } catch {
    return resolveRealPath(location);
  }
}
