import type { BinaryExpression, Expression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createBinaryExpression } from "./createBinaryExpression";

/**
 * Create a {@link BinaryExpression} with the `,` operator: the comma operator,
 * which evaluates both operands and yields the right one.
 *
 * Shorthand for {@link createBinaryExpression} with the `CommaToken` operator.
 * The printer attaches the comma to the preceding operand and separates the
 * following operand with a space when the expression fits on one line.
 *
 * Given operands `a` and `b`, the printer emits:
 *
 * ```ts
 * a, b
 * ```
 *
 * @evidence contracts/common.md#principled-implementation CommaToken preserves left-then-right syntax and the right operand's result role; construction stores both expressions without evaluating or dropping either.
 * @evidence contracts/common.md#clear-and-simple-design The shared binary constructor retains the pair; expression-context grouping remains a printer decision.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The comma represents sequencing rather than replacing the left expression with a known no-effect assumption.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains sequencing and comma placement; its standalone example avoids implying automatic parentheses or a semicolon, and tags are separate.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param left The left-hand operand.
 * @param right The right-hand operand.
 * @returns The created {@link BinaryExpression}.
 */
export const createComma = (
  left: Expression,
  right: Expression,
): BinaryExpression =>
  createBinaryExpression(left, SyntaxKind.CommaToken, right);
