import type { Expression, PrefixUnaryExpression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createPrefixUnaryExpression } from "./createPrefixUnaryExpression";

/**
 * Create a {@link PrefixUnaryExpression} with the `!` operator: logical NOT.
 *
 * Shorthand for {@link createPrefixUnaryExpression} with the `ExclamationToken`
 * operator. The printer writes the operator directly before the operand with no
 * separating space.
 *
 * Given operand `a`, the printer emits:
 *
 * ```ts
 * !a;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param operand The operand to negate.
 * @returns The created {@link PrefixUnaryExpression}.
 * @evidence contracts/common.md#principled-implementation ExclamationToken retains logical negation and the operand expression without computing truthiness at construction time.
 * @evidence contracts/common.md#clear-and-simple-design A single prefix-builder call owns logical-not selection instead of an extra conditional expression representation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Negation remains explicit syntax rather than a guessed boolean constant or patched operand.
 * @evidence contracts/common.md#meaningful-documentation JSDoc names logical NOT, describes the operand and supplies a standalone expression example with separated tags.
 */
export const createLogicalNot = (operand: Expression): PrefixUnaryExpression =>
  createPrefixUnaryExpression(SyntaxKind.ExclamationToken, operand);
