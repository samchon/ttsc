import type { ObjectLiteralElement, ObjectLiteralExpression } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ObjectLiteralExpression}: a `{ ... }` object literal.
 *
 * `properties` are the members (assignments, shorthands, spreads, methods).
 * `multiLine` controls layout. When `true`, each property is printed on its own
 * line when the object is nonempty; otherwise width determines whether it
 * stays inline or breaks. Trailing punctuation also depends on whether the
 * outline occupies a destructuring assignment-target context.
 *
 * With a single property `a: 1` and `multiLine` of `true`, the printer emits:
 *
 * ```ts
 * {
 *   a: 1,
 * }
 * ```
 *
 * @evidence contracts/common.md#principled-implementation Member order is retained, including spreads whose position affects emitted value semantics; an absent member list defaults to empty syntax without evaluating properties.
 * @evidence contracts/common.md#clear-and-simple-design One make call stores the sequence and optional layout hint, keeping punctuation and context-dependent commas in the printer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts multiLine is an explicit layout request, and the empty-list default is a documented object form rather than consumer-specific content.
 * @evidence contracts/common.md#meaningful-documentation Native prose describes width and assignment-context layout accurately; the member example, parameters and tags use separate blocks under documentation guidance.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param properties The object members.
 * @param multiLine When `true`, print one entry per line.
 * @returns The created {@link ObjectLiteralExpression}.
 */
export const createObjectLiteralExpression = (
  properties: readonly ObjectLiteralElement[] = [],
  multiLine?: boolean,
): ObjectLiteralExpression =>
  make("ObjectLiteralExpression", { properties, multiLine });
