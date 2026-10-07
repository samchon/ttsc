import { TestValidator } from "@nestia/e2e";

import factory from "../../../../../packages/factory/src/index";
import { id, num, print, str } from "../../internal/helpers";

/**
 * Verifies printing of expression, return, and throw statements.
 *
 * `run();`, `return;`, `return 1;`, and `throw new Error("boom");`.
 *
 * 1. Expression, bare/value return and throw statements retain call/value payload
 *    and semicolons.
 * 2. Literal run();, return;, return value and throw-new Error sources specify the
 *    requested syntax independently.
 *
 * @evidence contracts/testing.md#behavioral-verification Expression, bare/value return and throw statements retain call/value payload and semicolons.
 * @evidence contracts/testing.md#independent-expectations Literal run();, return;, return value and throw-new Error sources specify the requested syntax independently.
 * @evidence contracts/testing.md#distinguishing-cases Bare versus operand return contrasts with throw and expression statements, catching lost optional expressions.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_simple_statements. Calls createExpressionStatement/createReturnStatement/createThrowStatement and print directly.
 */
export const test_simple_statements = (): void => {
  TestValidator.equals(
    "expression",
    print(
      factory.createExpressionStatement(
        factory.createCallExpression(id("run"), undefined, []),
      ),
    ),
    "run();",
  );
  TestValidator.equals(
    "return void",
    print(factory.createReturnStatement()),
    "return;",
  );
  TestValidator.equals(
    "return value",
    print(factory.createReturnStatement(num("1"))),
    "return 1;",
  );
  TestValidator.equals(
    "throw",
    print(
      factory.createThrowStatement(
        factory.createNewExpression(id("Error"), undefined, [str("boom")]),
      ),
    ),
    'throw new Error("boom");',
  );
};
