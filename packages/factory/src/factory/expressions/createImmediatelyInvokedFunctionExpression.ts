import type { CallExpression, Statement } from "../../ast";
import { createBlock } from "../statements/createBlock";
import { createCallExpression } from "./createCallExpression";
import { createFunctionExpression } from "./createFunctionExpression";
import { createParenthesizedExpression } from "./createParenthesizedExpression";

/**
 * Create an immediately-invoked function expression, e.g. `(function () { ...
 * })()`.
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
