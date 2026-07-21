import { TestValidator } from "@nestia/e2e";
import factory, { type Expression } from "@ttsc/factory";

import { id, print } from "../../internal/helpers";

const a = () => id("a");
const b = () => id("b");

/**
 * Exhaustively print every convenience operator alias.
 *
 * Each binary / prefix / postfix helper is exercised once, confirming it
 * delegates to the right operator token — full structural coverage of the alias
 * surface.
 */
export const test_all_operator_aliases = (): void => {
  const binary: [(l: Expression, r: Expression) => Expression, string][] = [
    [factory.createAdd, "a + b"],
    [factory.createSubtract, "a - b"],
    [factory.createMultiply, "a * b"],
    [factory.createDivide, "a / b"],
    [factory.createModulo, "a % b"],
    [factory.createExponent, "a ** b"],
    [factory.createBitwiseAnd, "a & b"],
    [factory.createBitwiseOr, "a | b"],
    [factory.createBitwiseXor, "a ^ b"],
    [factory.createLeftShift, "a << b"],
    [factory.createRightShift, "a >> b"],
    [factory.createUnsignedRightShift, "a >>> b"],
    [factory.createLogicalAnd, "a && b"],
    [factory.createLogicalOr, "a || b"],
    [factory.createEquality, "a == b"],
    [factory.createInequality, "a != b"],
    [factory.createStrictEquality, "a === b"],
    [factory.createStrictInequality, "a !== b"],
    [factory.createLessThan, "a < b"],
    [factory.createLessThanEquals, "a <= b"],
    [factory.createGreaterThan, "a > b"],
    [factory.createGreaterThanEquals, "a >= b"],
    [factory.createComma, "a, b"],
    [factory.createAssignment, "a = b"],
  ];
  for (const [fn, expected] of binary)
    TestValidator.equals(expected, print(fn(a(), b())), expected);

  const prefix: [(o: Expression) => Expression, string][] = [
    [factory.createPrefixPlus, "+a"],
    [factory.createPrefixMinus, "-a"],
    [factory.createPrefixIncrement, "++a"],
    [factory.createPrefixDecrement, "--a"],
    [factory.createLogicalNot, "!a"],
    [factory.createBitwiseNot, "~a"],
  ];
  for (const [fn, expected] of prefix)
    TestValidator.equals(expected, print(fn(a())), expected);

  const postfix: [(o: Expression) => Expression, string][] = [
    [factory.createPostfixIncrement, "a++"],
    [factory.createPostfixDecrement, "a--"],
  ];
  for (const [fn, expected] of postfix)
    TestValidator.equals(expected, print(fn(a())), expected);
};
