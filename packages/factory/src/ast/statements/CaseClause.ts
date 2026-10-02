import type { Expression } from "../expressions/Expression";
import type { Statement } from "./Statement";

/**
 * A `case` clause of a `switch`.
 *
 * Built by {@link factory.createCaseClause}.
 *
 * @evidence contracts/common.md#principled-implementation A case expression and ordered statements preserve the label/body distinction without evaluating equality or fallthrough behavior.
 * @evidence contracts/common.md#clear-and-simple-design The case owns its expression and statement sequence; the enclosing CaseBlock owns clause order.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The branch expression is supplied syntax, not a hardcoded expected switch outcome.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies case syntax and describes its match expression and body order; comments follow the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface CaseClause {
  /** Discriminant tag; always `"CaseClause"`. */
  kind: "CaseClause";

  /** Match expression following case. */
  expression: Expression;

  /** Clause body in printed order. */
  statements: readonly Statement[];
}
