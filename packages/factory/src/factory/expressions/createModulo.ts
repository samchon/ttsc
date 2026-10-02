import type { BinaryExpression, Expression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createBinaryExpression } from "./createBinaryExpression";

/**
 * Create a remainder expression: `left % right`.
 *
 * Thin wrapper over {@link createBinaryExpression} with the `%` operator.
 *
 * With `left` of `a` and `right` of `b`, the printer emits:
 *
 * ```ts
 * a % b
 * ```
 *
 * @evidence contracts/common.md#principled-implementation PercentToken represents the language's remainder operation, retaining dividend/divisor order rather than asserting mathematical modulo behavior for negative values.
 * @evidence contracts/common.md#clear-and-simple-design A single binary-builder call selects remainder without implementing a second arithmetic evaluator.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The percent operator is the helper's documented operation, not a patched remainder result or fixed modulus.
 * @evidence contracts/common.md#meaningful-documentation Native prose accurately calls the operation remainder and documents operand positions; example and tags use separate blocks under documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param left The left-hand operand.
 * @param right The right-hand operand.
 * @returns The created {@link BinaryExpression}.
 */
export const createModulo = (
  left: Expression,
  right: Expression,
): BinaryExpression =>
  createBinaryExpression(left, SyntaxKind.PercentToken, right);
