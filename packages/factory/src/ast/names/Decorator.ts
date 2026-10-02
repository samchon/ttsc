import type { Expression } from "../expressions/Expression";

/**
 * A decorator applied to a declaration, e.g. `@Component`.
 *
 * Built by {@link factory.createDecorator}.
 *
 * @evidence contracts/common.md#principled-implementation The Decorator kind and expression preserve the operand printed after @; semantic decorator eligibility belongs to TypeScript checking.
 * @evidence contracts/common.md#clear-and-simple-design The operand is the only decorator payload; declaration attachment remains with its owner.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Decorator is a syntax discriminant, with no consumer substitution or foreign mutation.
 * @evidence contracts/common.md#meaningful-documentation JSDoc locates the decorator operand and constructor; separated member prose follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface Decorator {
  /** Discriminant tag; always `"Decorator"`. */
  kind: "Decorator";

  /** The decorator expression (after the `@`). */
  expression: Expression;
}
