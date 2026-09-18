import type { IRootPattern } from "./IRootPattern";
import { isPackageDirectory } from "./isPackageDirectory";

/** Iterative glob-state traversal avoids recursion on deep directory trees. */
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
              (directory || component.mentionsMin || !hasMinJsSuffix(part)))) &&
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
function hasMinJsSuffix(part: string): boolean {
  return (process.platform === "linux" ? part : part.toLowerCase()).endsWith(
    ".min.js",
  );
}
