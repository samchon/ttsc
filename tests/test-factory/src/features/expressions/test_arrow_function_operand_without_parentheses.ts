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
 * Verifies arrow function printing: stays bare in assignment and
 * disallowed-comma contexts.
 *
 * Negative twin of the arrow parenthesizer fixes. The assignment-level
 * `ArrowFunction` precedence must wrap only the positions the grammar rejects;
 * an over-match would wrap the everyday shapes generators emit constantly —
 * assignment right-hand sides, call arguments, array elements, property values,
 * and nested arrow bodies — and bloat every generated file.
 *
 * 1. Print an arrow function as the right-hand side of `=` and `??=`.
 * 2. Print an arrow function as a call argument, array element, property value,
 *    and concise arrow body.
 * 3. Assert none of the outputs are parenthesized.
 */
export const test_arrow_function_operand_without_parentheses = (): void => {
  TestValidator.equals(
    "assignment right-hand side",
    print(
      factory.createBinaryExpression(id("a"), SyntaxKind.EqualsToken, arrow()),
    ),
    "a = () => x",
  );
  TestValidator.equals(
    "nullish assignment right-hand side",
    print(
      factory.createBinaryExpression(
        id("a"),
        SyntaxKind.QuestionQuestionEqualsToken,
        arrow(),
      ),
    ),
    "a ??= () => x",
  );
  TestValidator.equals(
    "call argument",
    print(factory.createCallExpression(id("fn"), undefined, [arrow()])),
    "fn(() => x)",
  );
  TestValidator.equals(
    "array element",
    print(factory.createArrayLiteralExpression([arrow()])),
    "[() => x]",
  );
  TestValidator.equals(
    "property value",
    print(
      factory.createObjectLiteralExpression([
        factory.createPropertyAssignment(id("p"), arrow()),
      ]),
    ),
    "{ p: () => x }",
  );
  TestValidator.equals(
    "concise arrow body",
    print(
      factory.createArrowFunction(
        undefined,
        undefined,
        [],
        undefined,
        undefined,
        arrow(),
      ),
    ),
    "() => () => x",
  );
};
