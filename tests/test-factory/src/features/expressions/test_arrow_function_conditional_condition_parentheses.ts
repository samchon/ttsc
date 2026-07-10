import { TestValidator } from "@nestia/e2e";
import factory, { type Expression } from "@ttsc/factory";

import { id, print } from "../../internal/helpers";

const arrow = (body: string): Expression =>
  factory.createArrowFunction(
    undefined,
    undefined,
    [],
    undefined,
    undefined,
    id(body),
  );

/**
 * Verifies conditional expression parenthesizer: wraps an arrow function
 * condition but not arrow branches.
 *
 * Locks `TsPrinter.conditionalCondition` against the assignment-level
 * `ArrowFunction` precedence. With primary precedence the condition printed
 * bare, so `(() => x) ? a : b` re-parsed as an arrow whose body is the whole
 * conditional and the always-truthy-condition program disappeared. The branches
 * sit in disallowed-comma positions above the arrow's precedence, so they must
 * stay bare.
 *
 * 1. Print a conditional expression whose condition is an arrow function.
 * 2. Print a conditional expression whose branches are arrow functions.
 * 3. Assert the condition is parenthesized and the branches are not.
 */
export const test_arrow_function_conditional_condition_parentheses =
  (): void => {
    TestValidator.equals(
      "arrow condition",
      print(
        factory.createConditionalExpression(
          arrow("x"),
          undefined,
          id("a"),
          undefined,
          id("b"),
        ),
      ),
      "(() => x) ? a : b",
    );
    TestValidator.equals(
      "arrow branches stay bare",
      print(
        factory.createConditionalExpression(
          id("cond"),
          undefined,
          arrow("a"),
          undefined,
          arrow("b"),
        ),
      ),
      "cond ? () => a : () => b",
    );
  };
