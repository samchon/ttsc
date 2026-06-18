import type { Expression } from "./Expression";

/**
 * A `typeof` expression (value space).
 *
 * Built by {@link factory.createTypeOfExpression}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface TypeOfExpression {
  /** Discriminant tag; always `"TypeOfExpression"`. */
  kind: "TypeOfExpression";

  /** The expression. */
  expression: Expression;
}
