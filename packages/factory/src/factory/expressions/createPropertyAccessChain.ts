import type {
  Expression,
  Identifier,
  PrivateIdentifier,
  PropertyAccessChain,
  Token,
} from "../../ast";
import { make } from "../internal/make";
import { createIdentifier } from "../names/createIdentifier";

/**
 * Create a {@link PropertyAccessChain}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @param questionDotToken The questionDotToken.
 * @param name The name.
 * @returns The created node.
 */
export const createPropertyAccessChain = (
  expression: Expression,
  questionDotToken: Token | undefined,
  name: string | Identifier | PrivateIdentifier,
): PropertyAccessChain =>
  make("PropertyAccessChain", {
    expression,
    questionDotToken,
    name: typeof name === "string" ? createIdentifier(name) : name,
  });
