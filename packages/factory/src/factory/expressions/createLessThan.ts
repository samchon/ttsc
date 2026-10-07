import type { BinaryExpression, Expression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createBinaryExpression } from "./createBinaryExpression";

/**
 * Create a {@link BinaryExpression} with the `<` operator: less-than comparison.
 *
 * Shorthand for {@link createBinaryExpression} with the `LessThanToken`
 * operator. Flat output uses spaces around it; width can break after it.
 *
 * TypeScript reads `a < b > (c)` as a call with type arguments. The printer
 * keeps a `<` comparison unambiguous: it parenthesizes the comparison when a
 * later `>` followed by `(` or a template could close it, and writes a right
 * operand that holds such a `>` as `(+0 as number, ...)`, which leaves its
 * value unchanged.
 *
 * Given operands `a` and `b`, the printer emits:
 *
 * ```ts
 * a < b;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param left The left-hand operand.
 * @param right The right-hand operand.
 * @returns The created {@link BinaryExpression}.
 * @evidence contracts/common.md#principled-implementation LessThanToken preserves the relation and operand order without evaluating comparison or swapping it into a greater-than form.
 * @evidence contracts/common.md#clear-and-simple-design One binary-constructor delegation defines the helper; shared node shape and precedence need no duplicate implementation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The requested relation is retained instead of selecting a constant boolean for expected operand cases.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies the comparison and both operands, with a separate expression example and acknowledgment block under documentation guidance. The paragraph on type-argument ambiguity and the (+0 as number, ...) operand states what the printer adds.
 */
export const createLessThan = (
  left: Expression,
  right: Expression,
): BinaryExpression =>
  createBinaryExpression(left, SyntaxKind.LessThanToken, right);
