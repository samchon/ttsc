import type { ConditionalExpression, Expression, Token } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ConditionalExpression}.
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
