import type { Expression, Node, PartiallyEmittedExpression } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link PartiallyEmittedExpression}: a transform wrapper that prints
 * only its inner `expression`.
 *
 * This node exists to carry transform bookkeeping such as the `original` source
 * node. The printer emits the inner expression alone and ignores `original`;
 * this constructor does not strip type syntax from the inner expression.
 *
 * With `expression` of `a`, the printer emits:
 *
 * ```ts
 * a;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression to emit.
 * @param original The original node this was derived from, if any.
 * @returns The created {@link PartiallyEmittedExpression}.
 * @evidence contracts/common.md#principled-implementation Inner expression and optional original provenance remain separate; transparent printer dispatch emits the operand without deriving output from original or erasing its inner type syntax.
 * @evidence contracts/common.md#clear-and-simple-design One make call retains emission input and provenance, leaving transform policy outside this bookkeeping wrapper.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The wrapper does not reinterpret original to disguise a missing transformation or patch already printed output.
 * @evidence contracts/common.md#meaningful-documentation Native prose states ignored provenance and no implicit type erasure; example, parameter roles and acknowledgment tags use separate blocks.
 */
export const createPartiallyEmittedExpression = (
  expression: Expression,
  original?: Node,
): PartiallyEmittedExpression =>
  make("PartiallyEmittedExpression", { expression, original });
