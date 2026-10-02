import type { Expression, PrefixUnaryExpression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createPrefixUnaryExpression } from "./createPrefixUnaryExpression";

/**
 * Create a unary plus expression: `+operand`.
 *
 * Thin wrapper over {@link createPrefixUnaryExpression} with the `+` operator.
 *
 * With `operand` of `a`, the printer emits:
 *
 * ```ts
 * +a
 * ```
 *
 * @evidence contracts/common.md#principled-implementation PlusToken in the prefix node represents unary plus distinctly from binary addition; the retained operand is not converted by the builder.
 * @evidence contracts/common.md#clear-and-simple-design Operator-specific construction delegates to the prefix builder, with lexical separation handled by the printer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unary plus is supplied language syntax rather than a precomputed numeric value for known inputs.
 * @evidence contracts/common.md#meaningful-documentation Native prose states unary plus and the operand role; example and acknowledgment tags remain distinct under documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param operand The operand.
 * @returns The created {@link PrefixUnaryExpression}.
 */
export const createPrefixPlus = (operand: Expression): PrefixUnaryExpression =>
  createPrefixUnaryExpression(SyntaxKind.PlusToken, operand);
