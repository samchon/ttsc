import type { CaseOrDefaultClause } from "./CaseOrDefaultClause";

/**
 * The `{ ... }` body of a `switch` statement.
 *
 * Built by {@link factory.createCaseBlock}.
 *
 * @evidence contracts/common.md#principled-implementation Ordered case/default variants preserve switch clause order; the array does not enforce unique defaults or evaluate case matches.
 * @evidence contracts/common.md#clear-and-simple-design One clause sequence separates switch grouping from individual clause bodies.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Clause order is supplied data, with no fixture-based branch selection.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies the switch body and ordered clauses; member separation follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface CaseBlock {
  /** Discriminant tag; always `"CaseBlock"`. */
  kind: "CaseBlock";

  /** Case and default clauses in printed order. */
  clauses: readonly CaseOrDefaultClause[];
}
