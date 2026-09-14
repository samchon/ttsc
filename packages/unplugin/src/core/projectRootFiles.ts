import path from "node:path";

import type { ITtscProjectMembershipPolicy } from "./tsconfigPaths";

interface IRootPattern {
  components: readonly (string | RegExp)[];
  literal: boolean;
}

const compiled = new WeakMap<ITtscProjectMembershipPolicy, IRootPattern[]>();

/**
 * Match configured root files or a directory that can contain one.
 *
 * This is discovery, not dependency membership: imports outside these specs
 * remain compiler inputs and are proven by the external-input snapshot.
 * TypeScript's include grammar has only *, ?, ** and implicit directory globs.
 * Unknown policies stay permissive; no filesystem existence probe is needed, so
 * a newly created directory receives the same answer as an existing one.
 */
export function matchesProjectRootFile(
  location: string,
  policy: ITtscProjectMembershipPolicy,
  directory: boolean,
): boolean {
  if (policy.rootFileSpecs === undefined) return true;
  let patterns = compiled.get(policy);
  if (patterns === undefined) {
    patterns = [
      ...policy.rootFileSpecs.files.map((spec) =>
        compile(rootSpelling(spec, policy), true),
      ),
      ...policy.rootFileSpecs.include.map((spec) =>
        compile(rootSpelling(spec, policy), false),
      ),
    ].filter((pattern): pattern is IRootPattern => pattern !== undefined);
    compiled.set(policy, patterns);
  }
  const parts = rootSpelling(location, policy).replace(/\\/g, "/").split("/");
  return patterns.some((pattern) => matches(parts, pattern, directory));
}

/**
 * Config ancestry is anchored physically, but the walk retains lexical paths.
 * Translate only the project-root prefix so opening the project through a
 * junction does not prune its roots. Child symlinks remain lexical and keep
 * their existing out-of-walk classification. Apply the same translation to
 * configDir templates, whose specs may still use the requested root spelling.
 */
function rootSpelling(
  location: string,
  policy: ITtscProjectMembershipPolicy,
): string {
  const resolved = path.resolve(location);
  const root = policy.rootFileSpecs?.root;
  if (root === undefined) return resolved;
  const relative = path.relative(root.path, resolved);
  return relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
    ? path.resolve(root.realpath, relative)
    : resolved;
}

function compile(spec: string, literal: boolean): IRootPattern | undefined {
  const parts = path.resolve(spec).replace(/\\/g, "/").split("/");
  if (!literal) {
    const last = parts.at(-1)!;
    if (last === "**") return undefined;
    if (!/[.*?]/.test(last)) parts.push("**", "*");
  }
  return {
    literal,
    components: parts.map((part) => {
      if (literal || !/[*?]/.test(part) || part === "**") return part;
      const expression = [...part]
        .map((char) =>
          char === "*"
            ? "[^/]*"
            : char === "?"
              ? "[^/]"
              : char.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&"),
        )
        .join("");
      // Case folding on macOS is conservative on case-sensitive volumes.
      return new RegExp(
        `^${part.startsWith("*") || part.startsWith("?") ? "(?!\\.)" : ""}${expression}$`,
        process.platform === "linux" ? "u" : "iu",
      );
    }),
  };
}

/** Iterative glob-state traversal avoids recursion on deep directory trees. */
function matches(
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
      } else if (component instanceof RegExp) {
        if (!isPackageDirectory(part) && component.test(part))
          next.add(state + 1);
      } else if (
        process.platform === "linux"
          ? component === part
          : component.toLowerCase() === part.toLowerCase()
      ) {
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

function isPackageDirectory(name: string): boolean {
  return /^(node_modules|bower_components|jspm_packages)$/i.test(name);
}
