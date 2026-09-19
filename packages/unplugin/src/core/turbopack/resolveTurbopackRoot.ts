import path from "node:path";

import { pathIsWithin } from "../transform/filesystem/pathIsWithin";

/**
 * The directory the loader keeps every dependency inside, so that none leaves
 * the project filesystem root Turbopack was created with (samchon/ttsc#1422).
 *
 * Turbopack fails a whole module whose dependency lies outside that root. The
 * root is one the configuration names, `turbopack.root` or
 * `outputFileTracingRoot`, or, when it names none, one Next detects. Both kinds
 * contain the project directory, so every candidate is an ancestor of it, and
 * the deepest candidate lies inside whichever of them Turbopack uses. The
 * project directory stands in when the configuration names none: it lies inside
 * every root Turbopack can have. An input between it and a wider root then
 * reaches the bridge instead of Turbopack, and the module is re-run in a later
 * process rather than reused, so a wider root costs caching, never correctness.
 * Naming the root in the configuration lets Turbopack track those inputs
 * itself.
 *
 * @param projectRoot The Next project directory, the loader's `rootContext`.
 * @param configured The roots the configuration names.
 */
export function resolveTurbopackRoot(
  projectRoot: string,
  configured: readonly string[] = [],
): string {
  const project = path.resolve(projectRoot);
  let deepest: string | undefined;
  for (const candidate of configured) {
    const absolute = path.resolve(candidate);
    if (!pathIsWithin(project, absolute)) continue;
    if (deepest === undefined || pathIsWithin(absolute, deepest)) {
      deepest = absolute;
    }
  }
  return deepest ?? project;
}
