import type { Token } from "../names/Token";
import type { Expression } from "./Expression";

/**
 * A `yield` (or `yield*`) expression.
 *
 * Built by {@link factory.createYieldExpression}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface YieldExpression {
  /** Discriminant tag; always `"YieldExpression"`. */
  kind: "YieldExpression";

  /** AsteriskToken. */
  asteriskToken?: Token;

  /** Expression. */
  expression?: Expression;
}
