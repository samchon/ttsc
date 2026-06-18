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
 */
export const createOptionalTypeNode = (type: TypeNode): OptionalTypeNode =>
  make("OptionalTypeNode", { type });
