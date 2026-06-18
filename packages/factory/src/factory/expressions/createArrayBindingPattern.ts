import type { ArrayBindingElement, ArrayBindingPattern } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ArrayBindingPattern}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param elements The elements.
 * @returns The created node.
 */
export const createArrayBindingPattern = (
  elements: readonly ArrayBindingElement[],
): ArrayBindingPattern => make("ArrayBindingPattern", { elements });
