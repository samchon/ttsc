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
 * Verifies unary operator parenthesizer: wraps arrow function operands of
 * prefix unary and unary keyword expressions.
 *
 * Locks `TsPrinter.isUnaryExpression` against the assignment-level
 * `ArrowFunction` precedence. With primary precedence the arrow was accepted as
 * a UnaryExpression operand, but the grammar disallows it there, so `!() => x`,
 * `await () => x`, and `void () => x` were emitted as outright syntax errors. A
 * function expression really is a valid unary operand and must stay bare.
 *
 * 1. Print `!`, `await`, `void`, `typeof`, `delete`, and unary minus with an arrow
 *    function operand.
 * 2. Print `!` with a function expression operand as the negative twin.
 * 3. Assert only the arrow operands are parenthesized.
 */
export const test_arrow_function_unary_operand_parentheses = (): void => {
  TestValidator.equals(
    "logical not",
    print(factory.createLogicalNot(arrow())),
    "!(() => x)",
  );
  TestValidator.equals(
    "await",
    print(factory.createAwaitExpression(arrow())),
    "await (() => x)",
  );
  TestValidator.equals(
    "void",
    print(factory.createVoidExpression(arrow())),
    "void (() => x)",
  );
  TestValidator.equals(
    "typeof",
    print(factory.createTypeOfExpression(arrow())),
    "typeof (() => x)",
  );
  TestValidator.equals(
    "delete",
    print(factory.createDeleteExpression(arrow())),
    "delete (() => x)",
  );
  TestValidator.equals(
    "unary minus",
    print(factory.createPrefixUnaryExpression(SyntaxKind.MinusToken, arrow())),
    "-(() => x)",
  );
  TestValidator.equals(
    "function expression operand stays bare",
    print(
      factory.createLogicalNot(
        factory.createFunctionExpression(
          undefined,
          undefined,
          undefined,
          undefined,
          [],
          undefined,
          factory.createBlock([]),
        ),
      ),
    ),
    "!function () {}",
  );
};
