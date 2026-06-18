import type { Expression, PostfixUnaryExpression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { make } from "../internal/make";

/**
 * Create a {@link PostfixUnaryExpression}: a unary operator that follows its
 * operand.
 *
 * `operand` is the target and `operator` is the trailing token, one of `++` or
 * `--`. The printer appends the operator directly after the operand with no
 * space.
 *
 * With `operand` of `a` and `operator` of `++`, the printer emits:
 *
 * ```ts
 * a++;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param operand The operand.
 * @param operator The trailing operator token (`++` or `--`).
 * @returns The created {@link PostfixUnaryExpression}.
 */
export const createPostfixUnaryExpression = (
  operand: Expression,
  operator: SyntaxKind,
): PostfixUnaryExpression =>
  make("PostfixUnaryExpression", { operand, operator });
