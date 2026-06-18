import { TestValidator } from "@nestia/e2e";
import factory from "@ttsc/factory";

import { id, print } from "../../internal/helpers";

/**
 * Print the convenience operator aliases.
 *
 * `createAdd` / `createStrictEquality` / `createLogicalAnd` /
 * `createAssignment` / `createUnsignedRightShift` delegate to
 * `createBinaryExpression`, while the prefix / postfix helpers delegate to the
 * unary builders.
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
