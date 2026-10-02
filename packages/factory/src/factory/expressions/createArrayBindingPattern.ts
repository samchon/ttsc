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
 * [a, b]
 * ```
 *
 * Callers provide legal binding order, with any rest binding last. The builder
 * retains the supplied sequence without checking those grammar constraints.
 *
 * @evidence contracts/common.md#principled-implementation The ArrayBindingPattern kind and unchanged binding-or-hole sequence preserve positional destructuring syntax; valid rest placement remains caller-owned.
 * @evidence contracts/common.md#clear-and-simple-design Shared make constructs the single sequence outline while the printer owns brackets, separators and layout.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Holes remain explicit nodes rather than invented bindings or hardcoded array positions.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains holes and rest-order premises, with ordered element documentation, expression example and separated tags.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param elements The binding elements.
 * @returns The created {@link ArrayBindingPattern}.
 */
export const createArrayBindingPattern = (
  elements: readonly ArrayBindingElement[],
): ArrayBindingPattern => make("ArrayBindingPattern", { elements });
