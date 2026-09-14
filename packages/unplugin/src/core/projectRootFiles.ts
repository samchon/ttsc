import path from "node:path";

import type { ITtscProjectMembershipPolicy } from "./tsconfigPaths";

interface IRootPattern {
  components: readonly (string | { expression: RegExp; wildcard: boolean })[];
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
      ...policy.rootFileSpecs.files.map((spec) => compile(spec, true)),
      ...policy.rootFileSpecs.include.map((spec) => compile(spec, false)),
    ].filter((pattern): pattern is IRootPattern => pattern !== undefined);
    compiled.set(policy, patterns);
  }
  return rootSpellings(location, policy).some((spelling) => {
    const parts = spelling.replace(/\\/g, "/").split("/");
    return patterns.some((pattern) => matches(parts, pattern, directory));
  });
}

/**
 * Config ancestry is anchored physically, but the walk retains lexical paths.
 * Match each equivalent project-root spelling without following child links.
 * Native Windows watchers expand short names even when regular realpath keeps
 * them. Keep patterns intact: a glob can begin above the root, and configDir
 * can retain the requested spelling even when ancestry uses the physical one.
 */
function rootSpellings(
  location: string,
  policy: ITtscProjectMembershipPolicy,
): string[] {
  const resolved = path.resolve(location);
  const root = policy.rootFileSpecs?.root;
  if (root === undefined) return [resolved];
  const spellings = [
    ...new Set([root.path, root.realpath, root.nativepath ?? root.realpath]),
  ];
  for (const spelling of spellings) {
    const relative = path.relative(spelling, resolved);
    if (
      relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative)
    )
      return spellings.map((candidate) => path.resolve(candidate, relative));
  }
  return [resolved];
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
      if (!literal && part === "**") return part;
      const wildcard = !literal && /[*?]/.test(part);
      if (!wildcard && process.platform === "linux") return part;
      const expression = [...part]
        .map((char) =>
          wildcard && char === "*"
            ? "[^/]*"
            : wildcard && char === "?"
              ? "[^/]"
              : char.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&"),
        )
        .join("");
      // Case folding on macOS is conservative on case-sensitive volumes.
      // Unicode simple folding also belongs to literal components: lowercasing
      // alone misses equivalences such as Greek sigma/final sigma in Go.
      return {
        expression: new RegExp(
          `^${wildcard && (part.startsWith("*") || part.startsWith("?")) ? "(?!\\.)" : ""}${expression}$`,
          process.platform === "linux" ? "u" : "iu",
        ),
        wildcard,
      };
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
      } else if (typeof component !== "string") {
        if (
          (!component.wildcard || !isPackageDirectory(part)) &&
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

function isPackageDirectory(name: string): boolean {
  return /^(node_modules|bower_components|jspm_packages)$/i.test(name);
}
