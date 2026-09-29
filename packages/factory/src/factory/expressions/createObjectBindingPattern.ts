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
 * Callers supply legal bindings and place any rest element last. Width may
 * break the pattern over lines rather than preserve its flat spacing.
 *
 * @evidence contracts/common.md#principled-implementation The ordered BindingElement sequence preserves object source/local mappings and defaults; legal rest combinations remain caller premises.
 * @evidence contracts/common.md#clear-and-simple-design Shared make stores one member sequence while the printer owns brace layout and separators.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Destructuring stays explicit syntax rather than generated stand-in local names or hardcoded source values.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains binding roles, rest placement and width-dependent formatting; example, parameters and acknowledgment block remain separate.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param elements The binding elements.
 * @returns The created {@link ObjectBindingPattern}.
 */
export const createObjectBindingPattern = (
  elements: readonly BindingElement[],
): ObjectBindingPattern => make("ObjectBindingPattern", { elements });
