import type { Expression } from "../expressions/Expression";
import type { Statement } from "./Statement";

/**
 * A `with` statement.
 *
 * Built by {@link factory.createWithStatement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface WithStatement {
  /** Discriminant tag; always `"WithStatement"`. */
  kind: "WithStatement";

  /** Expression. */
  expression: Expression;

  /** Statement. */
  statement: Statement;
}
