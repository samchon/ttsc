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
 */
export const createQualifiedName = (
  left: EntityName,
  right: string | Identifier,
): QualifiedName =>
  make("QualifiedName", { left, right: asName(right) as Identifier });
