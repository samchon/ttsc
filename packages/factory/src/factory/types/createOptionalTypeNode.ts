import type { OptionalTypeNode, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create an {@link OptionalTypeNode}: a `T?` optional element inside a tuple
 * type.
 *
 * The element type prints first, immediately followed by a `?`. This form is
 * only valid in tuple element position, for example `[string, number?]`.
 *
 * Given a `string` element type, the printer renders:
 *
 * ```ts
 * string?
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param type The element type.
 * @returns The created {@link OptionalTypeNode}.
 * @evidence contracts/common.md#principled-implementation
 *   OptionalTypeNode wraps the supplied element type so the printer can apply
 *   postfix grouping; the caller supplies its valid tuple-element context.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   A one-child wrapper models type optionality separately from optional
 *   property names and avoids encoding the marker inside a type string.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The child remains unchanged and no union with undefined is substituted
 *   merely to produce a superficially similar result.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   The native description identifies the tuple context and postfix marker;
 *   argument and return documentation describe the wrapped type.
 */
export const createOptionalTypeNode = (type: TypeNode): OptionalTypeNode =>
  make("OptionalTypeNode", { type });
