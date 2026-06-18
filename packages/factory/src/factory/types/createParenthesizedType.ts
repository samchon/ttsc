import type { ParenthesizedTypeNode, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ParenthesizedTypeNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param type The type.
 * @returns The created {@link ParenthesizedTypeNode}.
 */
export const createParenthesizedType = (
  type: TypeNode,
): ParenthesizedTypeNode => make("ParenthesizedTypeNode", { type });
