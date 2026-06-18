import type { ArrayBindingElement, ArrayBindingPattern } from "../../ast";
import { make } from "../internal/make";

/**
 * Create an {@link ArrayBindingPattern}: the `[a, b]` binding used in array
 * destructuring.
 *
 * The elements are {@link BindingElement} nodes or omitted-element holes. The
 * printer wraps them in square brackets, separated by a comma and a space.
 *
 * Given two binding elements named `a` and `b`, the printer emits:
 *
 * ```ts
 * [a, b];
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param elements The binding elements.
 * @returns The created {@link ArrayBindingPattern}.
 */
export const createArrayBindingPattern = (
  elements: readonly ArrayBindingElement[],
): ArrayBindingPattern => make("ArrayBindingPattern", { elements });
