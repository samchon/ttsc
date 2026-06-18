import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "@ttsc/factory";

import { kw, print } from "../../internal/helpers";

/**
 * Print {@link factory.createFunctionExpression|function expressions}.
 *
 * A named generator `function* gen(): void {}` and an anonymous `function ()
 * {}`.
 */
export const test_function_expression = (): void => {
  TestValidator.equals(
    "generator",
    print(
      factory.createFunctionExpression(
        undefined,
        factory.createToken(SyntaxKind.AsteriskToken),
        "gen",
        undefined,
        [],
        kw(SyntaxKind.VoidKeyword),
        factory.createBlock([], true),
      ),
    ),
    "function* gen(): void {}",
  );
  TestValidator.equals(
    "anonymous",
    print(
      factory.createFunctionExpression(
        undefined,
        undefined,
        undefined,
        undefined,
        [],
        undefined,
        factory.createBlock([], true),
      ),
    ),
    "function () {}",
  );
};
