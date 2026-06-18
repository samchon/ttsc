import type { ElementAccessChain, Expression, Token } from "../../ast";
import { make } from "../internal/make";
import { createNumericLiteral } from "../literals/createNumericLiteral";

/**
 * Create an {@link ElementAccessChain}: a bracket access that participates in an
 * optional chain.
 *
 * The `questionDotToken` is the `?.` token printed before the brackets. A
 * numeric `index` is wrapped with {@link createNumericLiteral}; any other
 * expression is used as the key directly. The printer wraps the key in square
 * brackets.
 *
 * Given object `obj`, an optional `?.` token and index `0`, the printer emits:
 *
 * ```ts
 * obj?.[0];
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The object expression.
 * @param questionDotToken The `?.` token, if this link is optional.
 * @param index The index or key.
 * @returns The created {@link ElementAccessChain}.
 */
export const createElementAccessChain = (
  expression: Expression,
  questionDotToken: Token | undefined,
  index: number | Expression,
): ElementAccessChain =>
  make("ElementAccessChain", {
    expression,
    questionDotToken,
    argumentExpression:
      typeof index === "number" ? createNumericLiteral(index) : index,
  });
