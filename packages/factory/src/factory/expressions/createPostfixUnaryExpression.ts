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
 * a++
 * ```
 *
 * SyntaxKind also permits unrelated tokens. Callers supply a legal update
 * operator and target; this constructor does not validate or update them.
 *
 * @evidence contracts/common.md#principled-implementation Ordered operand and trailing token preserve postfix syntax, with legal ++/-- and update-target validity required from callers of the broad accepted types.
 * @evidence contracts/common.md#clear-and-simple-design Shared make constructs the pair without a numeric evaluator or duplicate target shape.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The builder performs no foreign target mutation and does not substitute a known before-update value.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies supported operators and broad-type limitations; expression example and parameter descriptions remain separate from tags.
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
