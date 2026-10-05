import { TestValidator } from "@nestia/e2e";

import factory, {
  type Expression,
} from "../../../../../packages/factory/src/index";
import { id, print } from "../../internal/helpers";

const a = () => id("a");
const b = () => id("b");

/**
 * Verifies Exhaustively print every convenience operator alias.
 *
 * Each binary / prefix / postfix helper is exercised once, confirming it
 * delegates to the right operator token — full structural coverage of the alias
 * surface.
 *
 * 1. All binary, prefix and postfix convenience aliases emit the operator assigned
 *    to that alias while retaining a/b operands.
 * 2. The explicit alias-to-source table specifies operator tokens independently;
 *    no expected text is obtained by printing a generic binary node.
 *
 * @evidence contracts/testing.md#behavioral-verification All binary, prefix and postfix convenience aliases emit the operator assigned to that alias while retaining a/b operands.
 * @evidence contracts/testing.md#independent-expectations The explicit alias-to-source table specifies operator tokens independently; no expected text is obtained by printing a generic binary node.
 * @evidence contracts/testing.md#distinguishing-cases Arithmetic, equality, logical, bitwise, shift, assignment, prefix and postfix rows distinguish wrong alias wiring; comma spacing has a separate case.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_all_operator_aliases. Calls each of the 24 binary, 6 prefix and 2 postfix factory aliases on fresh identifiers a and b and prints the result; each row is its own TestValidator.equals whose title is the expected source text, so a failing row is identified by that text.
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
