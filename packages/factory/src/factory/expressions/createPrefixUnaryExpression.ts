import type { Expression, PrefixUnaryExpression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { make } from "../internal/make";

/**
 * Create a {@link PrefixUnaryExpression}: a unary operator that precedes its
 * operand.
 *
 * `operator` is the leading token, one of `+`, `-`, `~`, `!`, `++`, or `--`,
 * and `operand` is the target. The printer writes the operator immediately
 * before the operand with no space.
 *
 * With `operator` of `-` and `operand` of `1`, the printer emits:
 *
 * ```ts
 * -1;
 * ```
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
