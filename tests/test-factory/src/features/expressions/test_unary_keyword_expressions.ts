import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "@ttsc/factory";

import { id, kw, print, ref } from "../../internal/helpers";

/**
 * Print the assertion / keyword expressions.
 *
 * `as`, `satisfies`, non-null `!`, spread `...`, `await`, value-space `typeof`,
 * and a parenthesized expression.
 */
export const test_unary_keyword_expressions = (): void => {
  TestValidator.equals(
    "as",
    print(factory.createAsExpression(id("x"), kw(SyntaxKind.UnknownKeyword))),
    "x as unknown",
  );
  TestValidator.equals(
    "satisfies",
    print(factory.createSatisfiesExpression(id("x"), ref("T"))),
    "x satisfies T",
  );
  TestValidator.equals(
    "nonnull",
    print(factory.createNonNullExpression(id("x"))),
    "x!",
  );
  TestValidator.equals(
    "spread",
    print(factory.createSpreadElement(id("xs"))),
    "...xs",
  );
  TestValidator.equals(
    "await",
    print(factory.createAwaitExpression(id("p"))),
    "await p",
  );
  TestValidator.equals(
    "typeof",
    print(factory.createTypeOfExpression(id("v"))),
    "typeof v",
  );
  TestValidator.equals(
    "paren",
    print(factory.createParenthesizedExpression(id("x"))),
    "(x)",
  );
};
