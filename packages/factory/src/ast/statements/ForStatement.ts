import type { Expression } from "../expressions/Expression";
import type { ForInitializer } from "./ForInitializer";
import type { Statement } from "./Statement";

/**
 * A C-style `for` statement.
 *
 * Built by {@link factory.createForStatement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ForStatement {
  /** Discriminant tag; always `"ForStatement"`. */
  kind: "ForStatement";

  /** Initializer. */
  initializer?: ForInitializer;

  /** Condition. */
  condition?: Expression;

  /** Incrementor. */
  incrementor?: Expression;

  /** Statement. */
  statement: Statement;
}
