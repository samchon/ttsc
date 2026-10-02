import type { Statement } from "./Statement";

/**
 * The `default` clause of a `switch`.
 *
 * Built by {@link factory.createDefaultClause}.
 *
 * @evidence contracts/common.md#principled-implementation The default kind carries an ordered statement body without a case expression; uniqueness within a switch is not enforced by this shape.
 * @evidence contracts/common.md#clear-and-simple-design A single body sequence represents the clause while its enclosing CaseBlock owns ordering.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The default discriminant is syntax rather than a hardcoded fallback answer for consumers.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies the default clause and body sequence; native separation follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface DefaultClause {
  /** Discriminant tag; always `"DefaultClause"`. */
  kind: "DefaultClause";

  /** Default clause body in printed order. */
  statements: readonly Statement[];
}
