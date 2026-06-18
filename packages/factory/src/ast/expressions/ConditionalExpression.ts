import type { Expression } from "./Expression";

/**
 * A ternary conditional, e.g. `cond ? a : b`.
 *
 * Built by {@link factory.createConditionalExpression}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ConditionalExpression {
  /** Discriminant tag; always `"ConditionalExpression"`. */
  kind: "ConditionalExpression";

  /** The condition. */
  condition: Expression;

  /** The value when the condition holds. */
  whenTrue: Expression;

  /** The value otherwise. */
  whenFalse: Expression;
}
