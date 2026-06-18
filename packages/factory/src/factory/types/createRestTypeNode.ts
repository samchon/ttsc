import type { RestTypeNode, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link RestTypeNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param type The type.
 * @returns The created node.
 */
export const createRestTypeNode = (type: TypeNode): RestTypeNode =>
  make("RestTypeNode", { type });
