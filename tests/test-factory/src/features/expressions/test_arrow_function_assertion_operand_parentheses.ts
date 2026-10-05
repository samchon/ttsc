import { TestValidator } from "@nestia/e2e";

import factory, {
  type Expression,
  SyntaxKind,
} from "../../../../../packages/factory/src/index";
import { id, print, ref } from "../../internal/helpers";

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
 * Verifies assertion expression parenthesizer: wraps arrow function operands of
 * `as` and `satisfies`.
 *
 * Locks `TsPrinter.assertionExpressionOperand` against the assignment-level
 * `ArrowFunction` precedence. With primary precedence the operand printed bare,
 * so `(() => x) as T` re-parsed as an arrow whose body is `x as T` and the
 * assertion silently moved inside the body. The parentheses also stop the arrow
 * from swallowing anything after the assertion when the assertion itself sits
 * bare in a wider expression, while a plain identifier operand must stay
 * unwrapped.
 *
 * 1. Print `as` and `satisfies` expressions whose operand is an arrow function.
 * 2. Print the assertion as a bare left binary operand and an identifier operand
 *    as the negative twin.
 * 3. Assert only the arrow operand is parenthesized.
 *
 * @evidence contracts/testing.md#behavioral-verification Arrow operands of as and satisfies are printed in parentheses; the as expression itself stays unparenthesized as the left operand of ||, and an identifier operand of as stays bare.
 * @evidence contracts/testing.md#independent-expectations Literal (() => x) as T and satisfies counterparts fix grouping from TypeScript precedence rather than another printer.
 * @evidence contracts/testing.md#distinguishing-cases As versus satisfies arrow wrappers and non-arrow negative twins prevent wrapping every assertion operand.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_arrow_function_assertion_operand_parentheses. Builds each assertion operand with createArrowFunction/createAsExpression/createSatisfiesExpression and prints in process.
 */
export const test_arrow_function_assertion_operand_parentheses = (): void => {
  TestValidator.equals(
    "as operand",
    print(factory.createAsExpression(arrow(), ref("T"))),
    "(() => x) as T",
  );
  TestValidator.equals(
    "satisfies operand",
    print(factory.createSatisfiesExpression(arrow(), ref("T"))),
    "(() => x) satisfies T",
  );
  TestValidator.equals(
    "asserted arrow as left binary operand",
    print(
      factory.createBinaryExpression(
        factory.createAsExpression(arrow(), ref("T")),
        SyntaxKind.BarBarToken,
        id("y"),
      ),
    ),
    "(() => x) as T || y",
  );
  TestValidator.equals(
    "identifier operand stays bare",
    print(factory.createAsExpression(id("x"), ref("T"))),
    "x as T",
  );
};
