import type { Expression } from "./Expression";

/**
 * A `void` expression.
 *
 * Built by {@link factory.createVoidExpression}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface VoidExpression {
  /** Discriminant tag; always `"VoidExpression"`. */
  kind: "VoidExpression";

  /** Expression. */
  expression: Expression;
}
