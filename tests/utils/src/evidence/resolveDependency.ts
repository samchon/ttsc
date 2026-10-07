import { createRequire } from "node:module";
import path from "node:path";

import { suiteRoot } from "./suiteRoot";

/**
 * Resolves a dependency's package root, not its entry point.
 *
 * Walks up from the `package.json` rather than trusting a main entry: `ttsc`
 * resolves to a launcher, and what is needed here is the package root.
 *
 * @evidence contracts/common.md#principled-implementation Resolving the package manifest through a require scoped to the owning suite obtains its actual package root rather than a launcher main entry.
 * @evidence contracts/common.md#clear-and-simple-design One package-root resolver serves dependency preparation without implementing package lookup itself.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Actual Node resolution errors propagate and an arbitrary workspace fallback cannot hide a missing dependency.
 * @evidence contracts/common.md#meaningful-documentation The paragraphs explain manifest resolution and why a main entry would return the wrong root.
 * @evidence contracts/portability.md#os-neutral-implementation Node module resolution and native dirname preserve filesystem package location; package specifiers retain their protocol spelling.
 * @evidence contracts/performance.md#efficient-algorithms One package resolution and dirname replace workspace enumeration.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The helper caches no dependency root; callers own any stable prepared dependency lifetime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Resolution retains no open handle, child or mutable helper state.
 */
export const resolveDependency = (specifier: string): string => {
  const manifest: string = createRequire(
    path.join(suiteRoot, "package.json"),
  ).resolve(`${specifier}/package.json`);
  return path.dirname(manifest);
};
