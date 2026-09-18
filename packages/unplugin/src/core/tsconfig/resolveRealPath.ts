import fs from "node:fs";

/** Resolve symlinks, retaining the original spelling when the path is missing. */
export function resolveRealPath(location: string): string {
  try {
    return fs.realpathSync(location);
  } catch {
    return location;
  }
}
