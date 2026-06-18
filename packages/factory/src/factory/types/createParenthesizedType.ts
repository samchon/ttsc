import type { ParenthesizedTypeNode, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ParenthesizedTypeNode}: a `(T)` explicitly parenthesized type.
 *
 * The printer always wraps the inner type in literal parentheses, so this is
 * the way to force grouping the surrounding printer would not add on its own,
 * for example to disambiguate a union inside a larger type.
 *
 * Given an `A | B` inner type, the printer renders:
 *
 * ```ts
 * A | B;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param type The inner type to parenthesize.
 * @returns The created {@link ParenthesizedTypeNode}.
 */
export const createParenthesizedType = (
  type: TypeNode,
): ParenthesizedTypeNode => make("ParenthesizedTypeNode", { type });
