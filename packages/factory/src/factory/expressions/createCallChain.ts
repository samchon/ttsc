import type { CallChain, Expression, Token, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link CallChain}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @param questionDotToken The questionDotToken.
 * @param typeArguments The typeArguments.
 * @param argumentsArray The argumentsArray.
 * @returns The created node.
 */
export const createCallChain = (
  expression: Expression,
  questionDotToken: Token | undefined,
  typeArguments: readonly TypeNode[] | undefined,
  argumentsArray: readonly Expression[] | undefined,
): CallChain =>
  make("CallChain", {
    expression,
    questionDotToken,
    typeArguments,
    arguments: argumentsArray ?? [],
  });
