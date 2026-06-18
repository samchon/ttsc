import type { Expression } from "../expressions/Expression";
import type { TypeNode } from "./TypeNode";

/**
 * An expression with type arguments, used in heritage clauses.
 *
 * Built by {@link factory.createExpressionWithTypeArguments}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ExpressionWithTypeArguments {
  /** Discriminant tag; always `"ExpressionWithTypeArguments"`. */
  kind: "ExpressionWithTypeArguments";

  /** The expression. */
  expression: Expression;

  /** The generic type arguments, if any. */
  typeArguments?: readonly TypeNode[];
}
