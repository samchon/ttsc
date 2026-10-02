import type { Expression } from "../expressions/Expression";
import type { Statement } from "./Statement";

/**
 * A `do...while` loop.
 *
 * Built by {@link factory.createDoStatement}.
 *
 * @evidence contracts/common.md#principled-implementation Body Statement and condition Expression preserve post-tested loop order; this type does not evaluate the condition or control flow.
 * @evidence contracts/common.md#clear-and-simple-design Two named parts expose the body/condition distinction using shared nodes.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Loop parts are supplied syntax, with no hardcoded iteration outcomes.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies do-while use and labels post-body condition and body; comments follow the documentation skill.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface DoStatement {
  /** Discriminant tag; always `"DoStatement"`. */
  kind: "DoStatement";

  /** Body executed before checking the loop condition. */
  statement: Statement;

  /** Condition printed after while at the end of the loop. */
  expression: Expression;
}
