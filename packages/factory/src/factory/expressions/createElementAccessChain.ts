import type { ElementAccessChain, Expression, Token } from "../../ast";
import { make } from "../internal/make";
import { createNumericLiteral } from "../literals/createNumericLiteral";

/**
 * Create a {@link ElementAccessChain}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @param questionDotToken The questionDotToken.
 * @param index The index.
 * @returns The created node.
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
