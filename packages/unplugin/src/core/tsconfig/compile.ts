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
 * comparison policy independently selects case sensitivity. Resolved specs use
 * the compiler's slash-normalized representation, not native identity.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Component compilation preserves literal-file versus include semantics,
 *   compiler case policy, recursive directories and JSON admission. Escaped
 *   literal predicates cannot activate regex grammar; wildcard tokens retain
 *   only TypeScript's star/question semantics.
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
 *   from the operating-system name. Omitted platform uses the native host;
 *   relative specs also use that path implementation's current-directory base.
 *   Separator normalization is compiler spelling, not physical canonicalization.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Resolution, separator conversion and splitting scale with path text.
 *   Wildcard compilation maps each code point to one star/question token or
 *   one escaped literal predicate. Literal components retain direct strings
 *   or one escaped expression. Resolution and retained tokens/expressions scale
 *   with specification text; component evaluation merges bounded token states.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Compiles one spec. matchesProjectRootFile owns sharing complete pattern
 *   lists by immutable policy and filesystem-view platform; rootSpellings uses
 *   a transient reconstruction for its current location query.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Transfers the pattern to its caller and owns no handle or historical cache;
 *   the membership matcher owns retention of shared pattern lists.
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
      const flags = caseSensitive ? "u" : "iu";
      const expression = wildcard
        ? [...part].map((char) =>
            char === "*" || char === "?"
              ? char
              : new RegExp(
                  `^${char.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&")}$`,
                  flags,
                ),
          )
        : new RegExp(
            `^${part.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&")}$`,
            flags,
          );
      // Unicode simple folding also belongs to literal components: lowercasing
      // alone misses equivalences such as Greek sigma/final sigma in Go.
      return {
        mentionsMin: (caseSensitive ? part : part.toLowerCase()).includes(
          ".min.",
        ),
        expression,
        wildcard,
      };
    }),
  };
}
