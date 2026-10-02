import type { IRootPattern } from "./IRootPattern";
import { isPackageDirectory } from "./isPackageDirectory";

/**
 * Match path components through the compiled glob's possible states.
 *
 * A directory needs a remaining filename component; completing an exact file
 * pattern does not authorize traversal into a directory with that file's name.
 *
 * @evidence contracts/common.md#principled-implementation
 *   State expansion allows recursive components to consume zero directories;
 *   transitions consume one part under literal or wildcard rules. A completed
 *   filename state differs from a viable directory prefix.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Two state sets express the current and next positions iteratively; compile
 *   owns grammar and this matcher owns transitions and acceptance.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Package, hidden-name and min.js rules are compiler wildcard semantics rather
 *   than branches selected for known test filenames.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose explains iterative matching and the nonobvious directory/file
 *   distinction; the min.js transition carries its compiler-semantic reason.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Matches path parts the caller already split on slashes, so no separator or case policy is chosen here; case folding is compiled into the pattern by the caller.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   Advances the glob state set one path part at a time, bounded by the
 *   component count.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache; the state sets are rebuilt per call.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   The state sets are local to the call.
 */
export function matches(
  parts: string[],
  pattern: IRootPattern,
  directory: boolean,
): boolean {
  const { components } = pattern;
  let states = new Set([0]);
  const expand = (): void => {
    for (const state of states) {
      if (!pattern.literal && components[state] === "**") states.add(state + 1);
    }
  };
  for (const part of parts) {
    expand();
    const next = new Set<number>();
    for (const state of states) {
      const component = components[state];
      if (component === undefined) continue;
      if (!pattern.literal && component === "**") {
        if (!part.startsWith(".") && !isPackageDirectory(part)) next.add(state);
      } else if (typeof component !== "string") {
        if (
          (!component.wildcard ||
            (!isPackageDirectory(part) &&
              // TypeScript-Go's file matcher leaves a `.min.js` name out of
              // every wildcard that does not spell `.min.` itself.
              (directory ||
                component.mentionsMin ||
                !hasMinJsSuffix(part, pattern.caseSensitive)))) &&
          component.expression.test(part)
        )
          next.add(state + 1);
      } else if (component === part) {
        next.add(state + 1);
      }
    }
    if (next.size === 0) return false;
    states = next;
  }
  expand();
  // A directory needs a remaining filename component, not just a completed
  // exact-file match; otherwise `include: ["*.ts"]` would descend into a
  // directory named `artifact.ts` and watch its unrelated children.
  return directory
    ? [...states].some((state) => state < components.length)
    : states.has(components.length);
}

/** `hasMinJsSuffix`, with the same case rule the compiled components use. */
function hasMinJsSuffix(part: string, caseSensitive: boolean): boolean {
  return (caseSensitive ? part : part.toLowerCase()).endsWith(".min.js");
}
