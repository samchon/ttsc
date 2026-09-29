import type { Expression, SatisfiesExpression, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link SatisfiesExpression}: an expression checked against a type
 * with `satisfies`.
 *
 * `expression` is the value syntax and `type` is the target of the source-level
 * check. The compiler determines assignability and contextual inference;
 * construction performs neither. The printer joins the constituents with
 * the `satisfies` keyword.
 *
 * With `expression` of `x` and `type` of `Foo`, the printer emits:
 *
 * ```ts
 * x satisfies Foo
 * ```
 *
 * @evidence contracts/common.md#principled-implementation Operand and TypeNode record satisfies syntax separately from as-assertion syntax; checking and contextual type inference remain compiler responsibilities, not guarantees of construction.
 * @evidence contracts/common.md#clear-and-simple-design One make call retains the two syntax constituents while keyword and parentheses remain printer-owned.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The builder does not replace checking with an assertion, patched operand or fabricated success result.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes requested checking from construction and contextual inference; example, parameter roles and tags are separate under documentation guidance.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression to check.
 * @param type The type the expression must satisfy.
 * @returns The created {@link SatisfiesExpression}.
 */
export const createSatisfiesExpression = (
  expression: Expression,
  type: TypeNode,
): SatisfiesExpression => make("SatisfiesExpression", { expression, type });
