import type { Expression } from "../expressions/Expression";
import type { ForInitializer } from "./ForInitializer";
import type { Statement } from "./Statement";

/**
 * A C-style `for` statement.
 *
 * Built by {@link factory.createForStatement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation Independently optional initializer, condition and incrementor plus required body preserve all three header slots, including omitted clauses; no execution is simulated.
 * @evidence contracts/common.md#clear-and-simple-design Explicit clause fields avoid positional guessing and share existing expression/statement nodes.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing clauses model source syntax without hardcoded termination or test-selected loop counts.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies C-style syntax and explains each omitted header clause; separated comments follow the documentation skill.
 */
export interface ForStatement {
  /** Discriminant tag; always `"ForStatement"`. */
  kind: "ForStatement";

  /** Initial header clause; omitted when no initialization syntax is present. */
  initializer?: ForInitializer;

  /** Loop condition; omitted when the header has no condition expression. */
  condition?: Expression;

  /** Expression after the second header semicolon, if present. */
  incrementor?: Expression;

  /** Loop body. */
  statement: Statement;
}
