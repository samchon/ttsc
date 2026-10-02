import type { Expression } from "../expressions/Expression";
import type { Statement } from "./Statement";

/**
 * A `while` loop.
 *
 * Built by {@link factory.createWhileStatement}.
 *
 * @evidence contracts/common.md#principled-implementation Condition Expression and body Statement preserve pre-tested loop syntax without evaluating truth or tracking iterations.
 * @evidence contracts/common.md#clear-and-simple-design Two named fields distinguish condition and body while sharing existing nodes.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Loop operands are supplied syntax, without hardcoded termination results.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies while syntax and labels the header condition and loop body; member separation follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface WhileStatement {
  /** Discriminant tag; always `"WhileStatement"`. */
  kind: "WhileStatement";

  /** Condition printed in the while header. */
  expression: Expression;

  /** Loop body. */
  statement: Statement;
}
