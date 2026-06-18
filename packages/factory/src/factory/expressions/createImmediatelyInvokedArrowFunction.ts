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
 * @author Jeongho Nam - https://github.com/samchon
 * @param statements The body statements.
 * @returns The created {@link CallExpression}.
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
