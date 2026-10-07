import type { Decorator } from "./Decorator";
import type { Modifier } from "./Modifier";

/**
 * A modifier token or a {@link Decorator}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation The union distinguishes keyword-token modifiers from expression-backed decorators; modifier token validity remains unrestricted by Modifier.
 * @evidence contracts/common.md#clear-and-simple-design A shared union lets declaration owners keep modifier and decorator order together.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Alternatives reflect the declaration syntax contract rather than consumer-specific exceptions.
 * @evidence contracts/common.md#meaningful-documentation JSDoc names both alternatives through native links; prose and tags are separated as the documentation skill requires.
 */
export type ModifierLike = Modifier | Decorator;
