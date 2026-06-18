import type { ConditionalExpression, Expression, Token } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ConditionalExpression}: a ternary `condition ? whenTrue :
 * whenFalse`.
 *
 * The `_questionToken` and `_colonToken` parameters exist only for signature
 * parity with the legacy factory and are ignored: the printer always emits `?`
 * and `:`, each surrounded by a single space.
 *
 * Given condition `cond` and branches `a` and `b`, the printer emits:
 *
 * ```ts
 * cond ? a : b;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param condition The condition.
 * @param _questionToken Ignored; present only to mirror the legacy signature.
 * @param whenTrue The value when the condition holds.
 * @param _colonToken Ignored; present only to mirror the legacy signature.
 * @param whenFalse The value otherwise.
 * @returns The created {@link ConditionalExpression}.
 */
export const createConditionalExpression = (
  condition: Expression,
  _questionToken: Token | undefined,
  whenTrue: Expression,
  _colonToken: Token | undefined,
  whenFalse: Expression,
): ConditionalExpression =>
  make("ConditionalExpression", { condition, whenTrue, whenFalse });
