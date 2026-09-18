import path from "node:path";

import type { IRootPattern } from "./IRootPattern";

/**
 * Compile one `include` or `files` specification into a component pattern.
 *
 * A literal `files` entry matches exactly one path. An `include` entry follows
 * TypeScript's wildcard grammar: `*` and `?` within one component, and `**` for
 * any number of directories, with a trailing directory spec expanded to `**`
 * followed by `*`. Components are compared case-insensitively except on Linux,
 * and a trailing bare `**` is rejected, as TypeScript rejects it.
 */
export function compile(
  spec: string,
  literal: boolean,
): IRootPattern | undefined {
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
