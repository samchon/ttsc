import type { ComputedPropertyName, Expression } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ComputedPropertyName}: a `[expression]` property key.
 *
 * Used as the name of an object-literal member, class member or signature so
 * the key is computed at runtime. The printer wraps the expression in square
 * brackets.
 *
 * Given expression `key`, the printer emits the key:
 *
 * ```ts
 * [key];
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The key expression.
 * @returns The created {@link ComputedPropertyName}.
 */
export const createComputedPropertyName = (
  expression: Expression,
): ComputedPropertyName => make("ComputedPropertyName", { expression });
