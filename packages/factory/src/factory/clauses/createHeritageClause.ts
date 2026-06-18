import type { ExpressionWithTypeArguments, HeritageClause } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { make } from "../internal/make";

/**
 * Create a {@link HeritageClause}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param token The token.
 * @param types The constituent types.
 * @returns The created {@link HeritageClause}.
 */
export const createHeritageClause = (
  token: SyntaxKind,
  types: readonly ExpressionWithTypeArguments[],
): HeritageClause => make("HeritageClause", { token, types });
