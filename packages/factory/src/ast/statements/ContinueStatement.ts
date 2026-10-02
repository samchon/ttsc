import type { Identifier } from "../names/Identifier";

/**
 * A `continue` statement, optionally labeled.
 *
 * Built by {@link factory.createContinueStatement}.
 *
 * @evidence contracts/common.md#principled-implementation Optional label distinguishes labeled and unlabeled continue syntax; existence of a loop target remains a checking concern.
 * @evidence contracts/common.md#clear-and-simple-design One optional Identifier exposes the only variable syntax part without binding state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Labels come from callers, without special loop names for tests or consumers.
 * @evidence contracts/common.md#meaningful-documentation JSDoc explains labeled continuation and absent labels; native member separation follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ContinueStatement {
  /** Discriminant tag; always `"ContinueStatement"`. */
  kind: "ContinueStatement";

  /** Enclosing loop label; omitted to continue the nearest enclosing loop. */
  label?: Identifier;
}
