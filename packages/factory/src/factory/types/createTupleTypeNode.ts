import type { TupleTypeNode, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link TupleTypeNode}: a `[A, B]` tuple type.
 *
 * The elements print inside `[...]`, comma separated. The list is width-aware:
 * inline it stays on one line with no trailing comma, and when it breaks each
 * element goes on its own line with a trailing comma after the last. Elements
 * may include named, optional, and rest members.
 *
 * Given the elements `string` and `number`, the printer renders:
 *
 * ```ts
 * [string, number];
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param elements The tuple element types.
 * @returns The created {@link TupleTypeNode}.
 */
export const createTupleTypeNode = (
  elements: readonly TypeNode[],
): TupleTypeNode => make("TupleTypeNode", { elements });
