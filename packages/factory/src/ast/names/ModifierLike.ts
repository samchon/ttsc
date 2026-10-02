import type { Decorator } from "./Decorator";
import type { Modifier } from "./Modifier";

/**
 * A modifier token or a {@link Decorator}.
 *
 * @evidence contracts/common.md#principled-implementation The union distinguishes keyword-token modifiers from expression-backed decorators; modifier token validity remains unrestricted by Modifier.
 * @evidence contracts/common.md#clear-and-simple-design A shared union lets declaration owners keep modifier and decorator order together.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Alternatives reflect the declaration syntax contract rather than consumer-specific exceptions.
 * @evidence contracts/common.md#meaningful-documentation JSDoc names both alternatives through native links; prose and tags are separated as the documentation skill requires.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export type ModifierLike = Modifier | Decorator;
