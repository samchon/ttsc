import type { Expression } from "./Expression";

/**
 * An `await` expression.
 *
 * Built by {@link factory.createAwaitExpression}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface AwaitExpression {
  /** Discriminant tag; always `"AwaitExpression"`. */
  kind: "AwaitExpression";

  /** The expression. */
  expression: Expression;
}
