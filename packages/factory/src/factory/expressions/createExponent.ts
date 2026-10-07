import type { BinaryExpression, Expression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createBinaryExpression } from "./createBinaryExpression";

/**
 * Create a {@link BinaryExpression} with the `**` operator: exponentiation.
 *
 * Shorthand for {@link createBinaryExpression} with the `AsteriskAsteriskToken`
 * operator. Flat output uses spaces around it; width can break after it.
 *
 * Given operands `a` and `b`, the printer emits:
 *
 * ```ts
 * a ** b;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param left The base operand.
 * @param right The exponent operand.
 * @returns The created {@link BinaryExpression}.
 * @evidence contracts/common.md#principled-implementation AsteriskAsteriskToken retains base/exponent order as exponentiation syntax; runtime arithmetic and operand validity are not established by construction.
 * @evidence contracts/common.md#clear-and-simple-design One binary-builder delegation selects exponentiation while the printer owns its associativity and operand parentheses.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The exponentiation operator is contract-defined, without power tables or expected-result substitutions for known inputs.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies exponentiation and operand roles, with an expression example separated from tags under documentation guidance.
 */
export const createExponent = (
  left: Expression,
  right: Expression,
): BinaryExpression =>
  createBinaryExpression(left, SyntaxKind.AsteriskAsteriskToken, right);
