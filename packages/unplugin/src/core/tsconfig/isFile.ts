import fs from "node:fs";

/**
 * Whether a path currently resolves to a regular file.
 *
 * Any failure to stat counts as "not a file", because `extends` resolution only
 * needs to know whether a candidate can be opened as a config.
 */
export function isFile(location: string): boolean {
  try {
    return fs.statSync(location).isFile();
  } catch {
    return false;
  }
}
