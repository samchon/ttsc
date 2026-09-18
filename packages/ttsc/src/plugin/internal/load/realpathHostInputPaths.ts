import path from "node:path";

import { realpathHostInput } from "./realpathHostInput";

/**
 * The physical target of each host input, keyed by its resolved path; `null`
 * where it does not resolve. Recorded beside the content hashes because
 * retargeting a symlinked input changes what it names without changing any
 * bytes a hash has seen yet.
 */
export function realpathHostInputPaths(
  files: readonly string[],
): Record<string, string | null> {
  return Object.fromEntries(
    files.map((file) => [path.resolve(file), realpathHostInput(file)]),
  );
}
