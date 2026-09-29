import type { Expression } from "./Expression";

/**
 * A computed member name, e.g. `[Symbol.iterator]`.
 *
 * Built by {@link factory.createComputedPropertyName}.
 *
 * The expression is the key-producing syntax inside brackets, not an already
 * computed string or symbol value. Valid member-name context is caller-owned.
 *
 * @evidence contracts/common.md#principled-implementation One Expression field preserves a computed key's syntax rather than coercing its runtime value into a literal name.
 * @evidence contracts/common.md#clear-and-simple-design The name wrapper owns bracketed-key identity; the operand remains a reusable expression node with no parallel key evaluator.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Computed keys remain explicit expressions instead of fixed names guessed from known inputs.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes key-producing syntax from evaluated values; the member describes its bracket role with documentation-compliant separation.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ComputedPropertyName {
  /** Discriminant tag; always `"ComputedPropertyName"`. */
  kind: "ComputedPropertyName";

  /** Expression that computes the member key, printed inside brackets. */
  expression: Expression;
}
