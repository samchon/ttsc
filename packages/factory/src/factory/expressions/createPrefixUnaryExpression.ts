import type { Expression, PrefixUnaryExpression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { make } from "../internal/make";

/**
 * Create a {@link PrefixUnaryExpression}: a unary operator that precedes its
 * operand.
 *
 * `operator` is the leading token, one of `+`, `-`, `~`, `!`, `++`, or `--`,
 * and `operand` is the target. The printer writes the operator immediately
 * before the operand, adding grouping or separation when needed to preserve
 * precedence and avoid merging adjacent operator tokens.
 *
 * With `operator` of `-` and `operand` of `1`, the printer emits:
 *
 * ```ts
 * -1
 * ```
 *
 * SyntaxKind permits unrelated tokens. Callers choose a legal prefix operator
 * and, for updates, an assignable operand; construction validates neither.
 *
 * @evidence contracts/common.md#principled-implementation Operator and operand retain prefix ordering without evaluation; the caller supplies a legal unary token and any required update target for these broad field types.
 * @evidence contracts/common.md#clear-and-simple-design One make call builds the pair, with precedence and lexical-token collision handling kept in the printer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The explicit operator does not select expected values, mutate foreign targets or conceal an invalid operand behind a replacement result.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains permitted operators, caller validity and lexical separation; example, parameters and tags remain separated under documentation guidance.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param operator The leading operator token.
 * @param operand The operand.
 * @returns The created {@link PrefixUnaryExpression}.
 */
export const createPrefixUnaryExpression = (
  operator: SyntaxKind,
  operand: Expression,
): PrefixUnaryExpression =>
  make("PrefixUnaryExpression", { operator, operand });
