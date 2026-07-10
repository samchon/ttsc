import { TestValidator } from "@nestia/e2e";
import factory, { type Expression, SyntaxKind } from "@ttsc/factory";

import { id, print } from "../../internal/helpers";

const arrow = (): Expression =>
  factory.createArrowFunction(
    undefined,
    undefined,
    [],
    undefined,
    undefined,
    id("x"),
  );

/**
 * Verifies expression binary parenthesizer: wraps arrow function operands on
 * both sides.
 *
 * Locks the `ArrowFunction` entry in `TsPrinter.expressionPrecedence` at the
 * assignment level. With primary precedence a left arrow operand printed bare,
 * so `(() => x) || y` re-parsed as an arrow whose body is `x || y` and the
 * right operand silently became unreachable. The right side must keep its
 * parentheses through the same general rule that previously needed a
 * right-side-only special case, while the comma operator stays below the
 * arrow's precedence and both comma sides stay bare.
 *
 * 1. Print binary expressions with an arrow function as the left operand of `||`,
 *    `+`, and `**`.
 * 2. Print the right-operand twin `y || (() => x)` and both comma-operator sides.
 * 3. Assert the operator sides are parenthesized and the comma sides are not.
 */
export const test_arrow_function_binary_operand_parentheses = (): void => {
  TestValidator.equals(
    "left logical or",
    print(
      factory.createBinaryExpression(arrow(), SyntaxKind.BarBarToken, id("y")),
    ),
    "(() => x) || y",
  );
  TestValidator.equals(
    "left additive",
    print(
      factory.createBinaryExpression(arrow(), SyntaxKind.PlusToken, id("y")),
    ),
    "(() => x) + y",
  );
  TestValidator.equals(
    "left exponentiation",
    print(
      factory.createBinaryExpression(
        arrow(),
        SyntaxKind.AsteriskAsteriskToken,
        id("y"),
      ),
    ),
    "(() => x) ** y",
  );
  TestValidator.equals(
    "right logical or",
    print(
      factory.createBinaryExpression(id("y"), SyntaxKind.BarBarToken, arrow()),
    ),
    "y || (() => x)",
  );
  TestValidator.equals(
    "left comma stays bare",
    print(factory.createComma(arrow(), id("y"))),
    "() => x , y",
  );
  TestValidator.equals(
    "right comma stays bare",
    print(factory.createComma(id("y"), arrow())),
    "y , () => x",
  );
};
