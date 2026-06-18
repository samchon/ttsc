import type { ArrayTypeNode, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ArrayTypeNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param elementType The element type.
 * @returns The created {@link ArrayTypeNode}.
 */
export const createArrayTypeNode = (elementType: TypeNode): ArrayTypeNode =>
  make("ArrayTypeNode", { elementType });
