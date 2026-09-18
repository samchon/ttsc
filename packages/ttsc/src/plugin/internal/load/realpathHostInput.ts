import fs from "node:fs";

/** Physical path selected by a host input, or null while it is unresolved. */
export function realpathHostInput(file: string): string | null {
  try {
    return fs.realpathSync.native(file);
  } catch {
    return null;
  }
}
