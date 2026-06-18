import type { BindingElement, ObjectBindingPattern } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ObjectBindingPattern}: the `{ ... }` binding form used to
 * destructure an object.
 *
 * `elements` are the binding elements, each naming a property to bind and
 * optionally a default or rest. The printer wraps the elements in braces and
 * separates them with commas, with a single space inside the braces.
 *
 * With binding elements `a` and `b`, the printer emits:
 *
 * ```ts
 * { a, b }
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param elements The binding elements.
 * @returns The created {@link ObjectBindingPattern}.
 */
export const createObjectBindingPattern = (
  elements: readonly BindingElement[],
): ObjectBindingPattern => make("ObjectBindingPattern", { elements });
