import type { Expression } from "../expressions/Expression";
import type { Statement } from "./Statement";

/**
 * An `if` / `else` statement.
 *
 * Built by {@link factory.createIfStatement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation Condition, required then branch and optional else branch preserve conditional statement parts; absence means no else syntax rather than a synthesized branch.
 * @evidence contracts/common.md#clear-and-simple-design Named branches expose conditional direction while Statement owns each branch's form.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Branches are supplied syntax, without fixture-specific condition answers or runtime overrides.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies if/else and explains branch and omission roles; native spacing follows the documentation skill.
 */
export interface IfStatement {
  /** Discriminant tag; always `"IfStatement"`. */
  kind: "IfStatement";

  /** Condition printed inside the if header. */
  expression: Expression;

  /** The statement run when the condition holds. */
  thenStatement: Statement;

  /** The statement run otherwise, if any. */
  elseStatement?: Statement;
}
