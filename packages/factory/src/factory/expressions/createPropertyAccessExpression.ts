import type {
  Expression,
  Identifier,
  PrivateIdentifier,
  PropertyAccessExpression,
} from "../../ast";
import { make } from "../internal/make";
import { createIdentifier } from "../names/createIdentifier";

/**
 * Create a {@link PropertyAccessExpression}: a dotted member access like `a.b`.
 *
 * `expression` is the receiver and `name` is the accessed member; a string
 * `name` is wrapped in an identifier. The printer joins them with a single dot
 * and no surrounding space.
 *
 * With `expression` of `a` and `name` of `b`, the printer emits:
 *
 * ```ts
 * a.b;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The receiver expression.
 * @param name The accessed member name.
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
