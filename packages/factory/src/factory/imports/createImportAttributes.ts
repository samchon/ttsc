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
 * The printer supports this clause directly and through import types and JSDoc
 * import tags. Import and export statements in this outline have no attributes
 * field. A true `multiLine` forces entries onto separate lines; otherwise the
 * available width selects the layout. Given a single `"type": "json"` entry
 * under the `with` keyword, direct printing renders:
 *
 * ```ts
 * with { "type": "json" }
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   The with/assert discriminant records the two supported introducing keywords
 *   and preserves ordered entries, including an empty brace clause. Statement
 *   attachment is not represented by this package's import/export builders.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Keyword, entries and layout preference stay in one reusable clause. Import
 *   types and JSDoc import tags own its context-specific attachment syntax.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   with is the documented default; unsupported statement attachment is stated
 *   rather than emulated with raw source replacement.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains keyword selection, empty lists and the attachment limitation
 *   in separated paragraphs with an example and blank lines before tags.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
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
