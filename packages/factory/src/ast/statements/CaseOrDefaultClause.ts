import type { CaseClause } from "./CaseClause";
import type { DefaultClause } from "./DefaultClause";

/**
 * A `case` or `default` clause of a `switch`.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation The union distinguishes expression-labeled CaseClause from the label-free DefaultClause without admitting arbitrary statements as clauses.
 * @evidence contracts/common.md#clear-and-simple-design A shared clause alias owns the two variants used by CaseBlock.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Alternatives express language forms rather than consumer-specific switch branches.
 * @evidence contracts/common.md#meaningful-documentation JSDoc names both switch-clause forms; prose/tag separation follows the documentation skill.
 */
export type CaseOrDefaultClause = CaseClause | DefaultClause;
