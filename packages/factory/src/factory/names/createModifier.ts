import type { Token } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createToken } from "./createToken";

/**
 * Create a {@link Token}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param kind The token kind.
 * @returns The created {@link Token}.
 */
export const createModifier = <TKind extends SyntaxKind>(
  kind: TKind,
): Token<TKind> => createToken(kind);
