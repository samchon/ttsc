import type { BinaryExpression, Expression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createBinaryExpression } from "./createBinaryExpression";

/**
 * Create a {@link BinaryExpression} with the `|` operator: bitwise OR.
 *
 * Shorthand for {@link createBinaryExpression} with the `BarToken` operator. The
 * printer uses spaces around it in flat output and can break after it by width.
 *
 * Given operands `a` and `b`, the printer emits:
 *
 * ```ts
 * a | b
 * ```
 *
 * @evidence contracts/common.md#principled-implementation BarToken with ordered operands records bitwise OR syntax, retaining the expressions rather than computing a numeric result.
 * @evidence contracts/common.md#clear-and-simple-design Binary construction is shared; this wrapper owns only selection of the OR operator.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The bar token is the documented operation rather than a consumer-specific flag value or patched operand.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies the operation and both operands, with its expression example and tags separated under documentation guidance.
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
export const createBitwiseOr = (
  left: Expression,
  right: Expression,
): BinaryExpression => createBinaryExpression(left, SyntaxKind.BarToken, right);
