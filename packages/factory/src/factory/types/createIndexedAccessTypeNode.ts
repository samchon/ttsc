import type { IndexedAccessTypeNode, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link IndexedAccessTypeNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param objectType The object type.
 * @param indexType The index type.
 * @returns The created {@link IndexedAccessTypeNode}.
 */
export const createIndexedAccessTypeNode = (
  objectType: TypeNode,
  indexType: TypeNode,
): IndexedAccessTypeNode =>
  make("IndexedAccessTypeNode", { objectType, indexType });
