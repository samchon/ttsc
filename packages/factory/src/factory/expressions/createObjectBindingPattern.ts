import type { BindingElement, ObjectBindingPattern } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ObjectBindingPattern}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param elements The elements.
 * @returns The created node.
 */
export const createObjectBindingPattern = (
  elements: readonly BindingElement[],
): ObjectBindingPattern => make("ObjectBindingPattern", { elements });
