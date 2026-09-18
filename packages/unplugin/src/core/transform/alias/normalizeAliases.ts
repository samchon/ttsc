import type { TtscDeclaredAlias } from "./TtscDeclaredAlias";

/**
 * Collect the host's declared aliases without deciding which of them can be
 * expressed as `paths`.
 *
 * That decision belongs to `createAliasPaths` alone. It used to be split: this
 * function's type guard required a string `find` and dropped Vite's `RegExp`
 * form before `createAliasPaths` ever saw it, which left `createAliasPaths`'s
 * own non-string branch unreachable and put the drop somewhere nothing could
 * report it (samchon/ttsc#1315).
 */
export function normalizeAliases(aliases: unknown): TtscDeclaredAlias[] {
  if (Array.isArray(aliases)) {
    return aliases.filter(isDeclaredAlias);
  }
  if (typeof aliases === "object" && aliases !== null) {
    return Object.entries(aliases)
      .filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      )
      .map(([find, replacement]) => ({ find, replacement }));
  }
  return [];
}

function isDeclaredAlias(value: unknown): value is TtscDeclaredAlias {
  return (
    typeof value === "object" &&
    value !== null &&
    "find" in value &&
    "replacement" in value &&
    typeof value.replacement === "string"
  );
}
