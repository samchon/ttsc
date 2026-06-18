import type { Expression, Node, PartiallyEmittedExpression } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link PartiallyEmittedExpression}: a transform wrapper that prints
 * only its inner `expression`.
 *
 * This node exists to carry transform bookkeeping such as the `original` source
 * node while the surrounding syntax (for example a stripped type assertion) is
 * dropped. The printer emits the inner expression alone; the wrapper itself
 * adds nothing to the output.
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
 */
export const createPartiallyEmittedExpression = (
  expression: Expression,
  original?: Node,
): PartiallyEmittedExpression =>
  make("PartiallyEmittedExpression", { expression, original });
