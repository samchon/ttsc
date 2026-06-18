import type { Expression, Token, YieldExpression } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link YieldExpression}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param asteriskToken The asteriskToken.
 * @param expression The expression.
 * @returns The created node.
 */
export const createYieldExpression = (
  asteriskToken: Token | undefined,
  expression: Expression | undefined,
): YieldExpression => make("YieldExpression", { asteriskToken, expression });
