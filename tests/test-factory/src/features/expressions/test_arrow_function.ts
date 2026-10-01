import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "../../../../../packages/factory/src/index";

import { id, kw, num, param, print } from "../../internal/helpers";

/**
 * Verifies printing of {@link factory.createArrowFunction|arrow functions}.
 *
 * A concise-body arrow `(x: number): number => x * 2` and a block-body arrow
 * whose body always breaks onto its own lines.
 *
 * 1. Typed concise and block-bodied arrows preserve parameter type, multiplication result and return statement.
 * 2. Exact arrow literals specify the =>, typed parameter and block indentation independently.
 *
 * @evidence contracts/testing.md#behavioral-verification Typed concise and block-bodied arrows preserve parameter type, multiplication result and return statement.
 * @evidence contracts/testing.md#independent-expectations Exact arrow literals specify the =>, typed parameter and block indentation independently.
 * @evidence contracts/testing.md#distinguishing-cases Expression body versus block body catches body-form confusion; object-body wrapping is covered by expression_context_parentheses.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_arrow_function. Calls createArrowFunction with expression/block bodies and print directly.
 */
export const test_arrow_function = (): void => {
  TestValidator.equals(
    "expr body",
    print(
      factory.createArrowFunction(
        undefined,
        undefined,
        [param("x", kw(SyntaxKind.NumberKeyword))],
        kw(SyntaxKind.NumberKeyword),
        undefined,
        factory.createBinaryExpression(
          id("x"),
          SyntaxKind.AsteriskToken,
          num("2"),
        ),
      ),
    ),
    "(x: number): number => x * 2",
  );
  TestValidator.equals(
    "block body",
    print(
      factory.createArrowFunction(
        undefined,
        undefined,
        [],
        undefined,
        undefined,
        factory.createBlock([factory.createReturnStatement(num("1"))], true),
      ),
    ),
    ["() => {", "  return 1;", "}"].join("\n"),
  );
};
