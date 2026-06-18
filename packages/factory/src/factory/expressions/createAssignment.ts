import type { BinaryExpression, Expression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createBinaryExpression } from "./createBinaryExpression";

/**
 * Convenience wrapper that builds the corresponding expression node.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param left The left.
 * @param right The right.
 * @returns The created expression.
 */
export const createAssignment = (
  left: Expression,
  right: Expression,
): BinaryExpression =>
  createBinaryExpression(left, SyntaxKind.EqualsToken, right);
