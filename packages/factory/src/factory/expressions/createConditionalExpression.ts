import type { ConditionalExpression, Expression, Token } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ConditionalExpression}: a ternary `condition ? whenTrue :
 * whenFalse`.
 *
 * The `_questionToken` and `_colonToken` parameters exist only for signature
 * parity with the legacy factory and are ignored: the printer always emits `?`
 * and `:`. Width-based layout can place the two branch markers on new lines.
 *
 * Given condition `cond` and branches `a` and `b`, the printer emits:
 *
 * ```ts
 * cond ? a : b
 * ```
 *
 * @evidence contracts/common.md#principled-implementation Separate condition and branches preserve ternary roles without evaluation; ignored punctuation tokens carry no payload because ? and : follow from the conditional kind.
 * @evidence contracts/common.md#clear-and-simple-design One make call stores the three expressions, with branch layout and punctuation remaining in the printer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Ignored compatibility tokens support the documented legacy signature rather than adding fixture-driven branch behavior or patched compiler tokens.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains ignored parameters and width-based branch layout, with the example and parameter roles separated from tags.
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
