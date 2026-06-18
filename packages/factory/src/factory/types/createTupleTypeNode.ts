import type { TupleTypeNode, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link TupleTypeNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param elements The elements.
 * @returns The created {@link TupleTypeNode}.
 */
export const createTupleTypeNode = (
  elements: readonly TypeNode[],
): TupleTypeNode => make("TupleTypeNode", { elements });
