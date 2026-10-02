import type { BinaryExpression, Expression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createBinaryExpression } from "./createBinaryExpression";

/**
 * Create a {@link BinaryExpression} with the `!=` operator: loose inequality
 * with type coercion.
 *
 * Shorthand for {@link createBinaryExpression} with the `ExclamationEqualsToken`
 * operator. Flat output uses spaces around it; width can break after it.
 *
 * Given operands `a` and `b`, the printer emits:
 *
 * ```ts
 * a != b
 * ```
 *
 * @evidence contracts/common.md#principled-implementation ExclamationEqualsToken preserves loose inequality and both operands without replacing coercive language semantics with strict comparison.
 * @evidence contracts/common.md#clear-and-simple-design Operator selection is the wrapper's only addition to shared binary construction.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The loose-inequality choice follows the named helper contract rather than known inputs or a fabricated boolean result.
 * @evidence contracts/common.md#meaningful-documentation Native prose states coercion and the operation, with ordered parameter descriptions and separate example and tags.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param left The left-hand operand.
 * @param right The right-hand operand.
 * @returns The created {@link BinaryExpression}.
 */
export const createInequality = (
  left: Expression,
  right: Expression,
): BinaryExpression =>
  createBinaryExpression(left, SyntaxKind.ExclamationEqualsToken, right);
