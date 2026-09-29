import type { BinaryExpression, Expression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createBinaryExpression } from "./createBinaryExpression";

/**
 * Create a {@link BinaryExpression} with the `^` operator: bitwise XOR.
 *
 * Shorthand for {@link createBinaryExpression} with the `CaretToken` operator.
 * Flat output surrounds the operator with spaces; width can break after it.
 *
 * Given operands `a` and `b`, the printer emits:
 *
 * ```ts
 * a ^ b
 * ```
 *
 * @evidence contracts/common.md#principled-implementation CaretToken retains bitwise XOR and the original operand order; runtime numeric semantics belong to emitted code, not node construction.
 * @evidence contracts/common.md#clear-and-simple-design A single binary-builder call selects XOR without another syntax representation or evaluator.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The caret is a contract-defined operator choice, not an input-derived output mask or fixture value.
 * @evidence contracts/common.md#meaningful-documentation JSDoc names XOR, describes operand positions and shows an expression example with tags separated by a blank comment line.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param left The left-hand operand.
 * @param right The right-hand operand.
 * @returns The created {@link BinaryExpression}.
 */
export const createBitwiseXor = (
  left: Expression,
  right: Expression,
): BinaryExpression =>
  createBinaryExpression(left, SyntaxKind.CaretToken, right);
