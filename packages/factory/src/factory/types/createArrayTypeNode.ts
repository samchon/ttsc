import type { ArrayTypeNode, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create an {@link ArrayTypeNode}: a `T[]` postfix array type.
 *
 * The element type is emitted in postfix-operand position, so a
 * lower-precedence form that would otherwise re-associate gets wrapped in
 * parentheses first. A union, intersection, function, constructor, conditional,
 * infer, or type-operator element prints as `(...)[]`; anything else prints
 * bare.
 *
 * Given a `string` element, the printer renders:
 *
 * ```ts
 * string[]
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param elementType The element type.
 * @returns The created {@link ArrayTypeNode}.
 */
export const createArrayTypeNode = (elementType: TypeNode): ArrayTypeNode =>
  make("ArrayTypeNode", { elementType });
