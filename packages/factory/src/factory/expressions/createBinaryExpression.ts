import type { BinaryExpression, Expression, Token } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { make } from "../internal/make";

/**
 * Create a {@link BinaryExpression}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param left The left-hand operand.
 * @param operator The operator token.
 * @param right The right-hand operand.
 * @returns The created {@link BinaryExpression}.
 */
export const createBinaryExpression = (
  left: Expression,
  operator: SyntaxKind | Token,
  right: Expression,
): BinaryExpression =>
  make("BinaryExpression", {
    left,
    operator: typeof operator === "object" ? (operator as any).token : operator,
    right,
  });
