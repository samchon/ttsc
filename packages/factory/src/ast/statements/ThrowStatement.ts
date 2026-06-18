import type { Expression } from "../expressions/Expression";

/**
 * A `throw` statement.
 *
 * Built by {@link factory.createThrowStatement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ThrowStatement {
  /** Discriminant tag; always `"ThrowStatement"`. */
  kind: "ThrowStatement";

  /** The expression. */
  expression: Expression;
}
