import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "@ttsc/factory";

import { id, kw, print } from "../../internal/helpers";

/**
 * Print {@link factory.createCallExpression|call expressions}.
 *
 * Verifies argument lists and explicit generic type arguments, e.g. `fn(a, b)`
 * and `fn<string>()`.
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
