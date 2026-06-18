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
 * })();
 * ```
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
