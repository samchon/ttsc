import type { BinaryExpression, Expression, Token } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { make } from "../internal/make";

/**
 * Create a {@link BinaryExpression}: two operands joined by an infix operator.
 *
 * The operator may be given as a `SyntaxKind` string (e.g. `"+"`, `"==="`,
 * `"&&"`) or as an operator {@link Token}, in which case its `token` value is
 * used. This is the base builder behind the operator-specific shorthands such
 * as {@link createAdd}, {@link createStrictEquality} and
 * {@link createLogicalAnd}.
 *
 * The printer surrounds the operator with a single space on each side.
 *
 * Given operands `a`, `b` and the `+` operator, the printer emits:
 *
 * ```ts
 * a + b;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param left The left-hand operand.
 * @param operator The operator token or its `SyntaxKind`.
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
