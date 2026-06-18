import type { Expression } from "./Expression";

/**
 * A `delete` expression.
 *
 * Built by {@link factory.createDeleteExpression}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface DeleteExpression {
  /** Discriminant tag; always `"DeleteExpression"`. */
  kind: "DeleteExpression";

  /** Expression. */
  expression: Expression;
}
