import type { Expression } from "../expressions/Expression";
import type { Statement } from "./Statement";

/**
 * A `while` loop.
 *
 * Built by {@link factory.createWhileStatement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface WhileStatement {
  /** Discriminant tag; always `"WhileStatement"`. */
  kind: "WhileStatement";

  /** Expression. */
  expression: Expression;

  /** Statement. */
  statement: Statement;
}
