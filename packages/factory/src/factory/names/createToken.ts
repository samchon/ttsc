import type { Token } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { make } from "../internal/make";

/**
 * Create a {@link Token}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param token The token.
 * @returns The created {@link Token}.
 */
export const createToken = <TKind extends SyntaxKind>(
  token: TKind,
): Token<TKind> => make("Token", { token }) as Token<TKind>;
