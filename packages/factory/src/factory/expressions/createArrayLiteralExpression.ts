import type { ArrayLiteralExpression, Expression } from "../../ast";
import { make } from "../internal/make";

/**
 * Create an {@link ArrayLiteralExpression}: an `[...]` array literal.
 *
 * The elements may include {@link SpreadElement} and omitted holes. When
 * `multiLine` is false or absent, the printer selects flat or broken layout by
 * width. When true, it requests a broken layout. Trailing punctuation depends
 * on holes and whether the array is a value or a destructuring assignment target.
 *
 * Given elements `1`, `2`, `3` on a single line, the printer emits:
 *
 * ```ts
 * [1, 2, 3]
 * ```
 *
 * @evidence contracts/common.md#principled-implementation The literal kind retains ordered expression entries including spreads and holes, and an absent list defaults to empty; valid list grammar remains caller-owned.
 * @evidence contracts/common.md#clear-and-simple-design One make call stores entries and the optional layout hint, with punctuation and width decisions remaining printer-owned.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The empty-list default and explicit multiLine option serve documented construction and layout, not consumer-selected values or output patches.
 * @evidence contracts/common.md#meaningful-documentation Native prose states width-dependent layout and contextual punctuation instead of promising always-inline output; examples and tags follow documentation separation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param elements The element expressions.
 * @param multiLine When `true`, print one entry per line.
 * @returns The created {@link ArrayLiteralExpression}.
 */
export const createArrayLiteralExpression = (
  elements: readonly Expression[] = [],
  multiLine?: boolean,
): ArrayLiteralExpression =>
  make("ArrayLiteralExpression", { elements, multiLine });
