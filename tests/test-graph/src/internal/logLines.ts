import fs from "node:fs";

/**
 * The non-empty lines of a log a fake wrote, or none when it never wrote one.
 *
 * A fake records by appending, so an absent file is "nothing happened" rather
 * than a failure, and a case reads that as the empty list it is.
 */
export function readLogLines(file: string): string[] {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split(/\r?\n/u)
    .filter((line) => line.trim() !== "");
}
