import { TestValidator } from "@nestia/e2e";
import factory from "../../../../../packages/factory/src/index";

import { num, print } from "../../internal/helpers";

/**
 * Verifies printing of immediately-invoked function / arrow expressions.
 *
 * `createImmediatelyInvokedFunctionExpression` and its arrow counterpart wrap a
 * body in a parenthesized callee and invoke it.
 *
 * 1. Function and arrow IIFEs preserve the call target grouping and return-one body.
 * 2. Exact independently authored multiline call sources distinguish invocation syntax from a bare function expression.
 *
 * @evidence contracts/testing.md#behavioral-verification Function and arrow IIFEs preserve the call target grouping and return-one body.
 * @evidence contracts/testing.md#independent-expectations Exact independently authored multiline call sources distinguish invocation syntax from a bare function expression.
 * @evidence contracts/testing.md#distinguishing-cases Function expression and arrow expression are separate target forms with the same body semantics.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_iife. Calls createImmediatelyInvokedFunctionExpression/createImmediatelyInvokedArrowFunction then TsPrinter.print in process.
 */
export const test_iife = (): void => {
  TestValidator.equals(
    "function IIFE",
    print(
      factory.createImmediatelyInvokedFunctionExpression([
        factory.createReturnStatement(num("1")),
      ]),
    ),
    ["(function () {", "  return 1;", "})()"].join("\n"),
  );
  TestValidator.equals(
    "arrow IIFE",
    print(
      factory.createImmediatelyInvokedArrowFunction([
        factory.createReturnStatement(num("1")),
      ]),
    ),
    ["(() => {", "  return 1;", "})()"].join("\n"),
  );
};
