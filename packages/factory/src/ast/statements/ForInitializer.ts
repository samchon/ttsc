import type { Expression } from "../expressions/Expression";
import type { VariableDeclarationList } from "./VariableDeclarationList";

/**
 * The initializer of a `for` loop: a declaration list or an expression.
 *
 * @evidence contracts/common.md#principled-implementation VariableDeclarationList and Expression distinguish declaration-based from expression-based loop initialization; assignment-target legality remains contextual.
 * @evidence contracts/common.md#clear-and-simple-design One alias shares the two initialization forms across for-loop variants.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Alternatives describe syntax forms without fixture-specific iteration setup.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies both initializer categories; prose/tag separation follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export type ForInitializer = VariableDeclarationList | Expression;
