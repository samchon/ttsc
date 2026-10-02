import type { BinaryExpression, Expression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createBinaryExpression } from "./createBinaryExpression";

/**
 * Create a {@link BinaryExpression} with the `&&` operator: logical AND with
 * short-circuit evaluation.
 *
 * Shorthand for {@link createBinaryExpression} with the
 * `AmpersandAmpersandToken` operator. Flat output uses spaces around it;
 * width can break after it.
 *
 * Given operands `a` and `b`, the printer emits:
 *
 * ```ts
 * a && b
 * ```
 *
 * @evidence contracts/common.md#principled-implementation AmpersandAmpersandToken retains short-circuit AND syntax with ordered operands; neither expression is evaluated during construction.
 * @evidence contracts/common.md#clear-and-simple-design One delegation selects the logical operator while the binary constructor and printer own node structure and grouping.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The right operand remains syntax rather than being dropped from a guessed left truthiness value.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains short-circuit meaning and operand order; the expression example and tags are separated following documentation guidance.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param left The left-hand operand.
 * @param right The right-hand operand.
 * @returns The created {@link BinaryExpression}.
 */
export const createLogicalAnd = (
  left: Expression,
  right: Expression,
): BinaryExpression =>
  createBinaryExpression(left, SyntaxKind.AmpersandAmpersandToken, right);
