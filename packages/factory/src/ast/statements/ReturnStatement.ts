import type { Expression } from "../expressions/Expression";

/**
 * A `return` statement.
 *
 * Built by {@link factory.createReturnStatement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ReturnStatement {
  /** Discriminant tag; always `"ReturnStatement"`. */
  kind: "ReturnStatement";

  /** The expression. */
  expression?: Expression;
}
