import type { Expression } from "../expressions/Expression";
import type { Statement } from "./Statement";

/**
 * An `if` / `else` statement.
 *
 * Built by {@link factory.createIfStatement}.
 *
 * @evidence contracts/common.md#principled-implementation Condition, required then branch and optional else branch preserve conditional statement parts; absence means no else syntax rather than a synthesized branch.
 * @evidence contracts/common.md#clear-and-simple-design Named branches expose conditional direction while Statement owns each branch's form.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Branches are supplied syntax, without fixture-specific condition answers or runtime overrides.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies if/else and explains branch and omission roles; native spacing follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
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
