import type { Expression } from "../expressions/Expression";
import type { Statement } from "./Statement";

/**
 * An `if` / `else` statement.
 *
 * Built by {@link factory.createIfStatement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface IfStatement {
  /** Discriminant tag; always `"IfStatement"`. */
  kind: "IfStatement";

  /** The expression. */
  expression: Expression;

  /** The statement run when the condition holds. */
  thenStatement: Statement;

  /** The statement run otherwise, if any. */
  elseStatement?: Statement;
}
