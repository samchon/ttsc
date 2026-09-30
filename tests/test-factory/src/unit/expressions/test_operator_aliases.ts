import { TestValidator } from "@nestia/e2e";
import factory from "../../../../../packages/factory/src/index";

import { id, print } from "../../internal/helpers";

/**
 * Verifies printing of the convenience operator aliases.
 *
 * `createAdd` / `createStrictEquality` / `createLogicalAnd` /
 * `createAssignment` / `createUnsignedRightShift` delegate to
 * `createBinaryExpression`, while the prefix / postfix helpers delegate to the
 * unary builders.
 *
 * 1. Convenience operator helpers emit their individual arithmetic, logical, assignment and update spellings.
 * 2. The authored expected source for each helper independently detects aliases wired to a neighboring operator.
 *
 * @evidence contracts/testing.md#behavioral-verification Convenience operator helpers emit their individual arithmetic, logical, assignment and update spellings.
 * @evidence contracts/testing.md#independent-expectations The authored expected source for each helper independently detects aliases wired to a neighboring operator.
 * @evidence contracts/testing.md#distinguishing-cases The representative aliases are complemented by all_operator_aliases; operand order and postfix placement remain observable here.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_operator_aliases. Calls each explicitly listed convenience alias and print under its own assertion label.
 */
export const test_operator_aliases = (): void => {
  TestValidator.equals(
    "add",
    print(factory.createAdd(id("a"), id("b"))),
    "a + b",
  );
  TestValidator.equals(
    "strict equality",
    print(factory.createStrictEquality(id("a"), id("b"))),
    "a === b",
  );
  TestValidator.equals(
    "logical and",
    print(factory.createLogicalAnd(id("a"), id("b"))),
    "a && b",
  );
  TestValidator.equals(
    "assignment",
    print(factory.createAssignment(id("a"), id("b"))),
    "a = b",
  );
  TestValidator.equals(
    "unsigned right shift",
    print(factory.createUnsignedRightShift(id("a"), id("b"))),
    "a >>> b",
  );
  TestValidator.equals(
    "prefix minus",
    print(factory.createPrefixMinus(id("a"))),
    "-a",
  );
  TestValidator.equals(
    "logical not",
    print(factory.createLogicalNot(id("a"))),
    "!a",
  );
  TestValidator.equals(
    "bitwise not",
    print(factory.createBitwiseNot(id("a"))),
    "~a",
  );
  TestValidator.equals(
    "prefix increment",
    print(factory.createPrefixIncrement(id("a"))),
    "++a",
  );
  TestValidator.equals(
    "postfix increment",
    print(factory.createPostfixIncrement(id("a"))),
    "a++",
  );
  TestValidator.equals(
    "postfix decrement",
    print(factory.createPostfixDecrement(id("a"))),
    "a--",
  );
};
