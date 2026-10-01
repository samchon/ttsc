import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "../../../../../packages/factory/src/index";

import { kw, print } from "../../internal/helpers";

/**
 * Verifies printing of {@link factory.createFunctionExpression|function expressions}.
 *
 * A named generator `function* gen(): void {}` and an anonymous `function ()
 * {}`.
 *
 * 1. A named generator and an anonymous ordinary function preserve name, star, return annotation and body shape.
 * 2. Literal function* and function source expectations independently fix declaration-like expression tokens.
 *
 * @evidence contracts/testing.md#behavioral-verification A named generator and an anonymous ordinary function preserve name, star, return annotation and body shape.
 * @evidence contracts/testing.md#independent-expectations Literal function* and function source expectations independently fix declaration-like expression tokens.
 * @evidence contracts/testing.md#distinguishing-cases Named/generator/typed versus anonymous/plain forms distinguish optional name and asterisk emission.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_function_expression. Calls createFunctionExpression for the two supplied shapes and print.
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
