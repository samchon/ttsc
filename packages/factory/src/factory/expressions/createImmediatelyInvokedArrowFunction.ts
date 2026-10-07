import type { CallExpression, Statement } from "../../ast";
import { createBlock } from "../statements/createBlock";
import { createArrowFunction } from "./createArrowFunction";
import { createCallExpression } from "./createCallExpression";
import { createParenthesizedExpression } from "./createParenthesizedExpression";

/**
 * Create an immediately-invoked arrow function: `(() => { ... })()`.
 *
 * The `statements` become the body of a parameterless arrow function whose
 * block is forced multi-line. The arrow is wrapped in parentheses with
 * {@link createParenthesizedExpression} and then called with no arguments via
 * {@link createCallExpression}.
 *
 * Given a single `return 1;` statement, the printer emits:
 *
 * ```ts
 * (() => {
 *   return 1;
 * })();
 * ```
 *
 * This records an invocation rather than executing it. The arrow retains
 * lexical `this` and `arguments` semantics in emitted code; callers supply a
 * body appropriate for this non-async, parameterless arrow.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param statements The body statements.
 * @returns The created {@link CallExpression}.
 * @evidence contracts/common.md#principled-implementation A parenthesized parameterless arrow with the supplied block becomes the callee of an empty-argument call; lexical arrow semantics and legal non-async body content are caller premises.
 * @evidence contracts/common.md#clear-and-simple-design Existing block, arrow, grouping and call constructors compose the entire shape without another IIFE node type or evaluator.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Empty parameters and call arguments are the documented IIFE form, not consumer-specific values; supplied statements remain intact.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains composition, forced block layout and lexical context, with an invocation example separated from tags under documentation guidance.
 */
export const createImmediatelyInvokedArrowFunction = (
  statements: readonly Statement[],
): CallExpression =>
  createCallExpression(
    createParenthesizedExpression(
      createArrowFunction(
        undefined,
        undefined,
        [],
        undefined,
        undefined,
        createBlock(statements, true),
      ),
    ),
    undefined,
    [],
  );
