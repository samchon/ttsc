import type { Expression } from "./Expression";

/**
 * A parenthesized expression, e.g. `(value)`.
 *
 * Built by {@link factory.createParenthesizedExpression}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ParenthesizedExpression {
  /** Discriminant tag; always `"ParenthesizedExpression"`. */
  kind: "ParenthesizedExpression";

  /** The expression. */
  expression: Expression;
}
