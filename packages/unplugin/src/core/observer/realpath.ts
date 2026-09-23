import fs from "node:fs";

/**
 * Resolve a path's physical target, or `undefined` when it cannot be resolved.
 *
 * Uses the native resolver, so Windows short names expand to the spelling
 * native watchers report.
 */
export function realpath(file: string): string | undefined {
  try {
    return fs.realpathSync.native(file);
  } catch {
    return undefined;
  }
}
