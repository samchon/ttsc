import type { BinaryExpression, Expression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createBinaryExpression } from "./createBinaryExpression";

/**
 * Create a subtraction expression: `left - right`.
 *
 * Thin wrapper over {@link createBinaryExpression} with the `-` operator.
 *
 * With `left` of `a` and `right` of `b`, the printer emits:
 *
 * ```ts
 * a - b
 * ```
 *
 * @evidence contracts/common.md#principled-implementation MinusToken preserves minuend/subtrahend order as subtraction syntax, without converting the expressions to numbers in the builder.
 * @evidence contracts/common.md#clear-and-simple-design One binary-builder delegation captures subtraction; it does not rewrite the operation into addition plus unary negation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The minus token represents the named operation, not a correction constant or known difference.
 * @evidence contracts/common.md#meaningful-documentation Native prose states subtraction and operand order, with an expression example separated from tags following documentation guidance.
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
export const createSubtract = (
  left: Expression,
  right: Expression,
): BinaryExpression =>
  createBinaryExpression(left, SyntaxKind.MinusToken, right);
