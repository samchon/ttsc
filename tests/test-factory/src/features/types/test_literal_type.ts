import { TestValidator } from "@nestia/e2e";

import factory from "../../../../../packages/factory/src/index";
import { print, str } from "../../internal/helpers";

/**
 * Verifies printing of {@link factory.createLiteralTypeNode|literal types}.
 *
 * A string literal type `"red"` and a boolean literal type `true`.
 *
 * 1. String and boolean literal types retain their literal spelling.
 * 2. Independent "red" and true sources specify the supplied values and string
 *    quoting.
 *
 * @evidence contracts/testing.md#behavioral-verification String and boolean literal types retain their literal spelling.
 * @evidence contracts/testing.md#independent-expectations Independent "red" and true sources specify the supplied values and string quoting.
 * @evidence contracts/testing.md#distinguishing-cases String versus boolean literals exercise distinct underlying nodes; negative numeric literal types are covered separately.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_literal_type. Calls createLiteralTypeNode around a string literal and createTrue then print.
 */
export const test_literal_type = (): void => {
  TestValidator.equals(
    "string",
    print(factory.createLiteralTypeNode(str("red"))),
    '"red"',
  );
  TestValidator.equals(
    "true",
    print(factory.createLiteralTypeNode(factory.createTrue())),
    "true",
  );
};
