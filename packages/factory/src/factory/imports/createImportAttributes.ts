import type { ImportAttribute, ImportAttributes } from "../../ast";
import { make } from "../internal/make";

/**
 * Create an {@link ImportAttributes}: the `with { ... }` (or legacy `assert {
 * ... }`) clause that annotates an import with metadata such as the resource
 * type.
 *
 * The `token` selects the introducing keyword: `"with"` (the default, current
 * syntax) or the legacy `"assert"`. Each element is an {@link ImportAttribute}
 * key/value entry. An empty list still prints the keyword and braces.
 *
 * Note that the printer does not attach this clause to the import or export
 * statements emitted by this package, so it surfaces only when you print the
 * attributes node directly. Given a single `"type": "json"` entry under the
 * `with` keyword, that direct print is:
 *
 * ```ts
 * with { "type": "json" }
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param elements The attribute entries.
 * @param multiLine When `true`, print one entry per line.
 * @param token The introducing keyword; defaults to `"with"`.
 * @returns The created {@link ImportAttributes}.
 */
export const createImportAttributes = (
  elements: readonly ImportAttribute[],
  multiLine?: boolean,
  token: "with" | "assert" = "with",
): ImportAttributes => make("ImportAttributes", { elements, multiLine, token });
