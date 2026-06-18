import { TestValidator } from "@nestia/e2e";
import factory from "@ttsc/factory";

import { id, num, print, str } from "../../internal/helpers";

/**
 * Print expression, return, and throw statements.
 *
 * `run();`, `return;`, `return 1;`, and `throw new Error("boom");`.
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
