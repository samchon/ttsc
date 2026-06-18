import type { IndexedAccessTypeNode, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create an {@link IndexedAccessTypeNode}: a `T[K]` indexed access type.
 *
 * The object type is emitted in postfix-operand position, so a lower-precedence
 * form (union, intersection, function, constructor, conditional, infer, or
 * type-operator) gets wrapped in parentheses before the `[...]`. The index type
 * prints bare inside the brackets.
 *
 * Given a `T` object type and a `"key"` index, the printer renders:
 *
 * ```ts
 * T["key"];
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param objectType The object type being indexed.
 * @param indexType The index type.
 * @returns The created {@link IndexedAccessTypeNode}.
 */
export const createIndexedAccessTypeNode = (
  objectType: TypeNode,
  indexType: TypeNode,
): IndexedAccessTypeNode =>
  make("IndexedAccessTypeNode", { objectType, indexType });
