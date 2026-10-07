import { TestValidator } from "@nestia/e2e";

import factory, { SyntaxKind } from "../../../../../packages/factory/src/index";
import { id, kw, print, ref } from "../../internal/helpers";

/**
 * Verifies printing of the assertion / keyword expressions.
 *
 * `as`, `satisfies`, non-null `!`, spread `...`, `await`, value-space `typeof`,
 * and a parenthesized expression.
 *
 * 1. As, satisfies, nonnull, spread, await, typeof and explicit parentheses retain
 *    their token syntax.
 * 2. The individual literal sources independently fix the supplied type/expression
 *    and operator markers.
 *
 * @evidence contracts/testing.md#behavioral-verification As, satisfies, nonnull, spread, await, typeof and explicit parentheses retain their token syntax.
 * @evidence contracts/testing.md#independent-expectations The individual literal sources independently fix the supplied type/expression and operator markers.
 * @evidence contracts/testing.md#distinguishing-cases Distinct keyword/postfix/spread node forms are sampled here; precedence-sensitive nesting is owned by assertion/context parenthesizer tests.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_unary_keyword_expressions. Calls the corresponding expression constructors and TsPrinter.print in the source unit process.
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
