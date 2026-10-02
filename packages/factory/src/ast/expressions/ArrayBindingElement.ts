import type { BindingElement } from "./BindingElement";
import type { OmittedExpression } from "./OmittedExpression";

/**
 * An element of an array binding pattern (or an elision).
 *
 * A hole consumes a position without introducing a binding. Rest placement
 * and the legality of each binding remain the caller's responsibility.
 *
 * @evidence contracts/common.md#principled-implementation BindingElement and OmittedExpression distinguish a declared binding from a skipped array position without treating a hole as an identifier.
 * @evidence contracts/common.md#clear-and-simple-design The two-member union reuses the binding and hole representations; it introduces no parallel element wrapper.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Elisions are explicit syntax nodes, not manufactured names used to imitate skipped positions.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains position consumption and caller-owned rest validity, with tags separated under the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export type ArrayBindingElement = BindingElement | OmittedExpression;
