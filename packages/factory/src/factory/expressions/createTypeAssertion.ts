import type { Expression, TypeAssertion, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link TypeAssertion}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param type The type.
 * @param expression The expression.
 * @returns The created node.
 */
export const createTypeAssertion = (
  type: TypeNode,
  expression: Expression,
): TypeAssertion => make("TypeAssertion", { type, expression });
