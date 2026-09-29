import type { Expression, PrefixUnaryExpression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createPrefixUnaryExpression } from "./createPrefixUnaryExpression";

/**
 * Create a {@link PrefixUnaryExpression} with the `~` operator: bitwise NOT.
 *
 * Shorthand for {@link createPrefixUnaryExpression} with the `TildeToken`
 * operator. The printer writes the operator directly before the operand with no
 * separating space.
 *
 * Given operand `a`, the printer emits:
 *
 * ```ts
 * ~a
 * ```
 *
 * @evidence contracts/common.md#principled-implementation TildeToken before the retained operand represents bitwise complement syntax without evaluating its numeric conversion.
 * @evidence contracts/common.md#clear-and-simple-design One prefix-builder delegation selects complement while printer lexical boundaries remain shared.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The operator is fixed by the helper contract, not a precomputed complement for known operands.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies complement, delegation and operand purpose; the expression example and tags are separated following documentation guidance.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param operand The operand to negate.
 * @returns The created {@link PrefixUnaryExpression}.
 */
export const createBitwiseNot = (operand: Expression): PrefixUnaryExpression =>
  createPrefixUnaryExpression(SyntaxKind.TildeToken, operand);
