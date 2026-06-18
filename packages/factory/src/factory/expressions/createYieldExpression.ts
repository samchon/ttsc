import type { Expression, Token, YieldExpression } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link YieldExpression}: a `yield` inside a generator.
 *
 * `asteriskToken`, when present, makes this a delegating `yield*`; otherwise a
 * plain `yield` is emitted. `expression` is the yielded value and may be
 * omitted for a bare `yield`. When a value is present the printer separates the
 * keyword from it with a single space; `yield*` attaches the asterisk directly
 * to the keyword.
 *
 * With no asterisk and `expression` of `x`, the printer emits:
 *
 * ```ts
 * yield x;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param asteriskToken The `*` token for a delegating `yield*`, if any.
 * @param expression The yielded value, if any.
 * @returns The created {@link YieldExpression}.
 */
export const createYieldExpression = (
  asteriskToken: Token | undefined,
  expression: Expression | undefined,
): YieldExpression => make("YieldExpression", { asteriskToken, expression });
