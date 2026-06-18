import type { Expression } from "../expressions/Expression";

/**
 * An expression used as a statement, e.g. `foo();`.
 *
 * Built by {@link factory.createExpressionStatement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ExpressionStatement {
  /** Discriminant tag; always `"ExpressionStatement"`. */
  kind: "ExpressionStatement";

  /** The expression. */
  expression: Expression;
}
