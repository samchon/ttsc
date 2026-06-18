import type {
  Expression,
  Identifier,
  PrivateIdentifier,
  PropertyAccessExpression,
} from "../../ast";
import { make } from "../internal/make";
import { createIdentifier } from "../names/createIdentifier";

/**
 * Create a {@link PropertyAccessExpression}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @param name The name.
 * @returns The created {@link PropertyAccessExpression}.
 */
export const createPropertyAccessExpression = (
  expression: Expression,
  name: string | Identifier | PrivateIdentifier,
): PropertyAccessExpression =>
  make("PropertyAccessExpression", {
    expression,
    name: typeof name === "string" ? createIdentifier(name) : name,
  });
