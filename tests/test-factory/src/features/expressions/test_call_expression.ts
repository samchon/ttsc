import { TestValidator } from "@nestia/e2e";

import factory, { SyntaxKind } from "../../../../../packages/factory/src/index";
import { id, kw, print } from "../../internal/helpers";

/**
 * Verifies printing of {@link factory.createCallExpression|call expressions}.
 *
 * Verifies argument lists and explicit generic type arguments, e.g. `fn(a, b)`
 * and `fn<string>()`.
 *
 * 1. Calls preserve two value arguments or a generic type argument with an empty
 *    value list.
 * 2. Literal fn(a, b) and fn<string>() independently specify argument punctuation
 *    and supplied names/types.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls preserve two value arguments or a generic type argument with an empty value list.
 * @evidence contracts/testing.md#independent-expectations Literal fn(a, b) and fn<string>() independently specify argument punctuation and supplied names/types.
 * @evidence contracts/testing.md#distinguishing-cases Nonempty values versus empty values with generic type arguments distinguish the two argument populations.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_call_expression. Calls createCallExpression with value/type argument arrays then print.
 */
export const test_call_expression = (): void => {
  TestValidator.equals(
    "args",
    print(
      factory.createCallExpression(id("fn"), undefined, [id("a"), id("b")]),
    ),
    "fn(a, b)",
  );
  TestValidator.equals(
    "type args",
    print(
      factory.createCallExpression(
        id("fn"),
        [kw(SyntaxKind.StringKeyword)],
        [],
      ),
    ),
    "fn<string>()",
  );
};
