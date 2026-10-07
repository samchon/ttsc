import { TestValidator } from "@nestia/e2e";

import factory, { SyntaxKind } from "../../../../../packages/factory/src/index";
import { kw, print } from "../../internal/helpers";

/**
 * Verifies printing of a class expression with a single property member.
 *
 * A class expression must retain its own name and member body when printed as
 * an expression.
 *
 * 1. A named class expression retains C and its typed x property without
 *    declaration-only syntax.
 * 2. Literal class C with its x: number; body independently fixes name and
 *    indentation.
 *
 * @evidence contracts/testing.md#behavioral-verification A named class expression retains C and its typed x property without declaration-only syntax.
 * @evidence contracts/testing.md#independent-expectations Literal class C with its x: number; body independently fixes name and indentation.
 * @evidence contracts/testing.md#distinguishing-cases This expression form complements class_declaration and expression-statement parenthesizing; it owns class-expression member emission.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_class_expression. Calls createClassExpression with a property declaration and TsPrinter.print.
 */
export const test_class_expression = (): void => {
  TestValidator.equals(
    "class expression",
    print(
      factory.createClassExpression(undefined, "C", undefined, undefined, [
        factory.createPropertyDeclaration(
          undefined,
          "x",
          undefined,
          kw(SyntaxKind.NumberKeyword),
          undefined,
        ),
      ]),
    ),
    ["class C {", "  x: number;", "}"].join("\n"),
  );
};
