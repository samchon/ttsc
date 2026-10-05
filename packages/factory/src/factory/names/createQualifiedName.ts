import type { EntityName, Identifier, QualifiedName } from "../../ast";
import { asName } from "../internal/asName";
import { make } from "../internal/make";

/**
 * Create a {@link QualifiedName}: a dotted name path such as `A.b` used in type
 * positions.
 *
 * The `left` is an entity name, either a single identifier or a nested
 * qualified name, which lets you chain segments like `A.B.c`. The `right` is
 * the final segment, accepted as a string or an {@link Identifier}; a string is
 * wrapped into an identifier automatically. The printer joins the two sides
 * with a dot.
 *
 * With `left` of `A` and `right` of `b`, this prints:
 *
 * ```ts
 * A.b;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param left The left-hand operand.
 * @param right The right-hand operand.
 * @returns The created {@link QualifiedName}.
 * @evidence contracts/common.md#principled-implementation
 *   EntityName permits nested left segments and the right argument is restricted
 *   to Identifier/string, making the asName result an identifier rather than a
 *   private name. The printer joins the segments as a type-position dotted name.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The builder preserves the left tree and normalizes only the final segment;
 *   callers compose deeper paths without another dotted-string parser.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The final segment passes through the identifier-only helper rather than
 *   coercing an unsupported node or patching a dotted source string.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains nesting and string normalization and shows A.b separately
 *   from the tags, applying the documentation skill's paragraph guidance.
 */
export const createQualifiedName = (
  left: EntityName,
  right: string | Identifier,
): QualifiedName => make("QualifiedName", { left, right: asName(right) });
