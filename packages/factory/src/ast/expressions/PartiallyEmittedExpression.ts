import type { Node } from "../Node";
import type { Expression } from "./Expression";

/**
 * An expression wrapper that emits only its inner expression, dropping any
 * surrounding type-only syntax. It emits as its underlying expression.
 *
 * Built by {@link factory.createPartiallyEmittedExpression}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface PartiallyEmittedExpression {
  /** Discriminant tag; always `"PartiallyEmittedExpression"`. */
  kind: "PartiallyEmittedExpression";

  /** The expression to emit. */
  expression: Expression;

  /** The original node this was derived from, if any. */
  original?: Node;
}
