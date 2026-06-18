import type { TypeNode, UnionTypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link UnionTypeNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param types The constituent types.
 * @returns The created {@link UnionTypeNode}.
 */
export const createUnionTypeNode = (
  types: readonly TypeNode[],
): UnionTypeNode => make("UnionTypeNode", { types });
