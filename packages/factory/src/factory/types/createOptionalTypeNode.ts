import type { OptionalTypeNode, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link OptionalTypeNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param type The type.
 * @returns The created node.
 */
export const createOptionalTypeNode = (type: TypeNode): OptionalTypeNode =>
  make("OptionalTypeNode", { type });
