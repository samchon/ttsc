import { TestValidator } from "@nestia/e2e";
import factory, { type Expression, SyntaxKind } from "../../../../../packages/factory/src/index";

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
 *
 * @evidence contracts/testing.md#behavioral-verification Arrow functions in left binary positions and right logical positions gain necessary parentheses, while comma positions remain bare.
 * @evidence contracts/testing.md#independent-expectations The explicit logical/arithmetic/exponentiation/comma expectations specify syntactic grouping independently.
 * @evidence contracts/testing.md#distinguishing-cases Left logical-or/addition/exponentiation, right logical-or and left/right comma rows distinguish precedence and side-dependent handling.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_arrow_function_binary_operand_parentheses. Calls createBinaryExpression around authored arrow operands and prints each labeled row.
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
    "() => x, y",
  );
  TestValidator.equals(
    "right comma stays bare",
    print(factory.createComma(id("y"), arrow())),
    "y, () => x",
  );
};
