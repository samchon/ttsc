import { TestValidator } from "@nestia/e2e";
import factory from "@ttsc/factory";

import { num, print } from "../../internal/helpers";

/**
 * Print immediately-invoked function / arrow expressions.
 *
 * `createImmediatelyInvokedFunctionExpression` and its arrow counterpart wrap a
 * body in a parenthesized callee and invoke it.
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
