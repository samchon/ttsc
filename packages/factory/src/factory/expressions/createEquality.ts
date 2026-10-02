import type { BinaryExpression, Expression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createBinaryExpression } from "./createBinaryExpression";

/**
 * Create a {@link BinaryExpression} with the `==` operator: loose equality with
 * type coercion.
 *
 * Shorthand for {@link createBinaryExpression} with the `EqualsEqualsToken`
 * operator. Flat output uses spaces around it; width can break after it.
 *
 * Given operands `a` and `b`, the printer emits:
 *
 * ```ts
 * a == b
 * ```
 *
 * @evidence contracts/common.md#principled-implementation EqualsEqualsToken preserves coercive equality syntax and both operands; this builder does not substitute strict equality or decide the comparison result.
 * @evidence contracts/common.md#clear-and-simple-design The wrapper selects loose equality through one binary constructor instead of carrying a second comparison schema.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The coercive operator is explicit in the helper contract rather than a guessed comparison rewrite for particular consumers.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes loose equality and coercion, with operand descriptions and separate expression/example acknowledgment blocks.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param left The left-hand operand.
 * @param right The right-hand operand.
 * @returns The created {@link BinaryExpression}.
 */
export const createEquality = (
  left: Expression,
  right: Expression,
): BinaryExpression =>
  createBinaryExpression(left, SyntaxKind.EqualsEqualsToken, right);
