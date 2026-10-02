import type { CaseClause } from "./CaseClause";
import type { DefaultClause } from "./DefaultClause";

/**
 * A `case` or `default` clause of a `switch`.
 *
 * @evidence contracts/common.md#principled-implementation The union distinguishes expression-labeled CaseClause from the label-free DefaultClause without admitting arbitrary statements as clauses.
 * @evidence contracts/common.md#clear-and-simple-design A shared clause alias owns the two variants used by CaseBlock.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Alternatives express language forms rather than consumer-specific switch branches.
 * @evidence contracts/common.md#meaningful-documentation JSDoc names both switch-clause forms; prose/tag separation follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export type CaseOrDefaultClause = CaseClause | DefaultClause;
