import type { IntersectionTypeNode, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link IntersectionTypeNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param types The constituent types.
 * @returns The created {@link IntersectionTypeNode}.
 */
export const createIntersectionTypeNode = (
  types: readonly TypeNode[],
): IntersectionTypeNode => make("IntersectionTypeNode", { types });
