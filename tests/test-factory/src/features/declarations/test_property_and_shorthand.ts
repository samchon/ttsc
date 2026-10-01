import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "../../../../../packages/factory/src/index";

import { kw, num, print } from "../../internal/helpers";

/**
 * Verifies printing of an optional class property and a shorthand assignment.
 *
 * `x?: number;` for a {@link factory.createPropertyDeclaration|property} and `x
 * = 1` for a {@link factory.createShorthandPropertyAssignment|shorthand}.
 *
 * 1. Optional class property x?: number; and shorthand initializer x = 1 print their different punctuation.
 * 2. Exact literal expectations specify the question mark, semicolon and assignment syntax independently.
 *
 * @evidence contracts/testing.md#behavioral-verification Optional class property x?: number; and shorthand initializer x = 1 print their different punctuation.
 * @evidence contracts/testing.md#independent-expectations Exact literal expectations specify the question mark, semicolon and assignment syntax independently.
 * @evidence contracts/testing.md#distinguishing-cases A declaration with no initializer contrasts with a shorthand assignment initializer; object ordinary properties are covered by object_literal.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_property_and_shorthand. Calls createPropertyDeclaration, createShorthandPropertyAssignment and TsPrinter.print.
 */
export const test_property_and_shorthand = (): void => {
  TestValidator.equals(
    "optional property",
    print(
      factory.createPropertyDeclaration(
        undefined,
        "x",
        factory.createToken(SyntaxKind.QuestionToken),
        kw(SyntaxKind.NumberKeyword),
        undefined,
      ),
    ),
    "x?: number;",
  );
  TestValidator.equals(
    "shorthand initializer",
    print(factory.createShorthandPropertyAssignment("x", num("1"))),
    "x = 1",
  );
};
