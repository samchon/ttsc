import type { ComputedPropertyName, Expression } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ComputedPropertyName}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @returns The created node.
 */
export const createComputedPropertyName = (
  expression: Expression,
): ComputedPropertyName => make("ComputedPropertyName", { expression });
