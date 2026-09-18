import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Content hash of each host input, keyed by its resolved path; `null` for an
 * input that cannot be read. A persistent plugin cache compares these against
 * the hashes it recorded to decide whether a descriptor must be evaluated
 * again.
 */
export function hashHostInputPaths(
  files: readonly string[],
): Record<string, string | null> {
  return Object.fromEntries(
    files.map((file) => [path.resolve(file), hashHostInput(file)]),
  );
}

function hashHostInput(file: string): string | null {
  try {
    if (fs.statSync(file).isDirectory()) {
      return crypto
        .createHash("sha256")
        .update("ttsc:host-input:directory\0")
        .digest("hex");
    }
    return crypto
      .createHash("sha256")
      .update(fs.readFileSync(file))
      .digest("hex");
  } catch {
    return null;
  }
}
