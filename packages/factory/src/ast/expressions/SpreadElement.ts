import type { Expression } from "./Expression";

/**
 * A spread element in an argument or array, e.g. `...items`.
 *
 * Built by {@link factory.createSpreadElement}.
 *
 * It represents expansion in value or argument lists and rest syntax in an
 * array assignment target. The type does not check iterability, rest position
 * or target validity.
 *
 * @evidence contracts/common.md#principled-implementation The expression operand and spread-element kind retain ... syntax across supported list contexts; iterability and assignment-rest restrictions remain caller premises.
 * @evidence contracts/common.md#clear-and-simple-design One operand describes the list entry; the enclosing call or array owns expansion position and separators.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Expansion is not replaced with elements enumerated from a known fixture or a patched iterator.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains expansion versus assignment-rest use and validation limits; member comments and tags remain distinct under documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface SpreadElement {
  /** Discriminant tag; always `"SpreadElement"`. */
  kind: "SpreadElement";

  /** The expression. */
  expression: Expression;
}
