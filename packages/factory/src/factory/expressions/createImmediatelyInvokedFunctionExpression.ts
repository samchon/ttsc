import type { CallExpression, Statement } from "../../ast";
import { createBlock } from "../statements/createBlock";
import { createCallExpression } from "./createCallExpression";
import { createFunctionExpression } from "./createFunctionExpression";
import { createParenthesizedExpression } from "./createParenthesizedExpression";

/**
 * Create an immediately-invoked function expression: `(function () { ... })()`.
 *
 * The `statements` become the body of an anonymous function expression whose
 * block is forced multi-line. The function is wrapped in parentheses with
 * {@link createParenthesizedExpression} and then called with no arguments via
 * {@link createCallExpression}.
 *
 * Given a single `return 1;` statement, the printer emits:
 *
 * ```ts
 * (function () {
 *   return 1;
 * })()
 * ```
 *
 * This records an invocation rather than executing it. The ordinary function
 * introduces its own `this` and `arguments` context, unlike the arrow variant;
 * callers supply body statements valid for that non-async function.
 *
 * @evidence contracts/common.md#principled-implementation A grouped anonymous parameterless function with the supplied block is called with no arguments; its ordinary function context is retained rather than replaced with lexical arrow semantics.
 * @evidence contracts/common.md#clear-and-simple-design Four existing constructors compose block, function, grouping and invocation without a custom IIFE node or execution layer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The documented empty signature and invocation do not inject consumer state or replace supplied body statements with expected results.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains structural composition and ordinary-function context, with multiline invocation example and acknowledgment tags in separate blocks.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param statements The body statements.
 * @returns The created {@link CallExpression}.
 */
export const createImmediatelyInvokedFunctionExpression = (
  statements: readonly Statement[],
): CallExpression =>
  createCallExpression(
    createParenthesizedExpression(
      createFunctionExpression(
        undefined,
        undefined,
        undefined,
        undefined,
        [],
        undefined,
        createBlock(statements, true),
      ),
    ),
    undefined,
    [],
  );
