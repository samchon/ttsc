import type { Expression } from "../expressions/Expression";
import type { ForInitializer } from "./ForInitializer";
import type { Statement } from "./Statement";

/**
 * A `for...in` statement.
 *
 * Built by {@link factory.createForInStatement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ForInStatement {
  /** Discriminant tag; always `"ForInStatement"`. */
  kind: "ForInStatement";

  /** Initializer. */
  initializer: ForInitializer;

  /** Expression. */
  expression: Expression;

  /** Statement. */
  statement: Statement;
}
