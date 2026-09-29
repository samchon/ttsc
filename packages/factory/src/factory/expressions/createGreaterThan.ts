import type { BinaryExpression, Expression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createBinaryExpression } from "./createBinaryExpression";

/**
 * Create a {@link BinaryExpression} with the `>` operator: greater-than
 * comparison.
 *
 * Shorthand for {@link createBinaryExpression} with the `GreaterThanToken`
 * operator. Flat output uses spaces around it; width can break after it.
 *
 * Given operands `a` and `b`, the printer emits:
 *
 * ```ts
 * a > b
 * ```
 *
 * @evidence contracts/common.md#principled-implementation GreaterThanToken preserves ordered relational operands; the emitted language determines comparison semantics rather than this syntax builder.
 * @evidence contracts/common.md#clear-and-simple-design A single binary-builder call owns operator selection, reusing the common comparison outline.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The greater-than token is the requested relation, not a guessed ordering result or consumer-specific branch.
 * @evidence contracts/common.md#meaningful-documentation Native prose names the comparison and operand positions, with expression example and tags separated following documentation guidance.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param left The left-hand operand.
 * @param right The right-hand operand.
 * @returns The created {@link BinaryExpression}.
 */
export const createGreaterThan = (
  left: Expression,
  right: Expression,
): BinaryExpression =>
  createBinaryExpression(left, SyntaxKind.GreaterThanToken, right);
