import type { Identifier } from "../names/Identifier";

/**
 * A `break` statement, optionally labeled.
 *
 * Built by {@link factory.createBreakStatement}.
 *
 * @evidence contracts/common.md#principled-implementation An optional Identifier records labeled versus unlabeled break; target existence and permitted control-flow placement remain unchecked.
 * @evidence contracts/common.md#clear-and-simple-design Only label presence varies, so one optional field suffices without resolution state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Supplied labels are syntax data rather than hardcoded loop names or recovery branches.
 * @evidence contracts/common.md#meaningful-documentation JSDoc distinguishes labeled breaks and omitted labels; separated member prose follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface BreakStatement {
  /** Discriminant tag; always `"BreakStatement"`. */
  kind: "BreakStatement";

  /** Target label; omitted for a break from the nearest enclosing loop or switch. */
  label?: Identifier;
}
