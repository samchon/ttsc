import path from "node:path";

import type { IRootPattern } from "./IRootPattern";

/**
 * Compile one `include` or `files` specification into a component pattern.
 *
 * A literal `files` entry matches exactly one path. An `include` entry follows
 * TypeScript's wildcard grammar: `*` and `?` within one component, and `**` for
 * any number of directories, with a trailing directory spec expanded to `**`
 * followed by `*`. Components compare under the compiler's case policy, and a
 * trailing bare `**` is rejected, as TypeScript rejects it. Only a literal
 * entry, or an include spec that itself ends in `.json`, can admit a JSON root
 * file.
 *
 * The filesystem view's platform selects path grammar; the compiler's
 * comparison policy independently selects case sensitivity.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Component compilation preserves literal-file versus include semantics,
 *   compiler case policy, recursive directories and JSON admission. RegExp
 *   metacharacters are escaped so only TypeScript's own wildcards are active.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The compiler produces one explicit pattern value; matches owns state
 *   traversal instead of recompiling grammar during each location query.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Hidden-name and min.js distinctions come from compiler grammar, not a
 *   consumer filename patch. Invalid trailing recursive specs stay uncompiled.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs describe literals, directory expansion, rejected trailing
 *   recursion and JSON admission; the Unicode-folding comment explains its reason.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Explicit filesystem-view platform selects Node's win32 or posix grammar,
 *   while compiler case policy remains a separate input rather than inferred
 *   from the operating-system name. Omitted platform uses the native host.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   Splits the path once and compiles each component once.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function compile(
  spec: string,
  literal: boolean,
  caseSensitive: boolean,
  platform: NodeJS.Platform = process.platform,
): IRootPattern | undefined {
  const paths = platform === "win32" ? path.win32 : path.posix;
  const parts = paths.resolve(spec).replace(/\\/g, "/").split("/");
  if (!literal) {
    const last = parts.at(-1)!;
    if (last === "**") return undefined;
    if (!/[.*?]/.test(last)) parts.push("**", "*");
  }
  return {
    caseSensitive,
    json: literal || spec.endsWith(".json"),
    literal,
    components: parts.map((part) => {
      if (!literal && part === "**") return part;
      const wildcard = !literal && /[*?]/.test(part);
      if (!wildcard && caseSensitive) return part;
      const expression = [...part]
        .map((char) =>
          wildcard && char === "*"
            ? "[^/]*"
            : wildcard && char === "?"
              ? "[^/]"
              : char.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&"),
        )
        .join("");
      // Unicode simple folding also belongs to literal components: lowercasing
      // alone misses equivalences such as Greek sigma/final sigma in Go.
      return {
        mentionsMin: (caseSensitive ? part : part.toLowerCase()).includes(
          ".min.",
        ),
        expression: new RegExp(
          `^${wildcard && (part.startsWith("*") || part.startsWith("?")) ? "(?!\\.)" : ""}${expression}$`,
          caseSensitive ? "u" : "iu",
        ),
        wildcard,
      };
    }),
  };
}
