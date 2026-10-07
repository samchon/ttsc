import type { Expression } from "../expressions/Expression";

/**
 * A decorator applied to a declaration, e.g. `@Component`.
 *
 * Built by {@link factory.createDecorator}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation The Decorator kind and expression preserve the operand printed after @; semantic decorator eligibility belongs to TypeScript checking.
 * @evidence contracts/common.md#clear-and-simple-design The operand is the only decorator payload; declaration attachment remains with its owner.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Decorator is a syntax discriminant, with no consumer substitution or foreign mutation.
 * @evidence contracts/common.md#meaningful-documentation JSDoc locates the decorator operand and constructor; separated member prose follows the documentation skill.
 */
export interface Decorator {
  /** Discriminant tag; always `"Decorator"`. */
  kind: "Decorator";

  /** The decorator expression (after the `@`). */
  expression: Expression;
}
