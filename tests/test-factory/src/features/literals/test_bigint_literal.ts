import { TestValidator } from "@nestia/e2e";

import factory from "../../../../../packages/factory/src/index";
import { print } from "../../internal/helpers";

/**
 * Verifies printing of {@link factory.createBigIntLiteral|BigInt literals}.
 *
 * The trailing `n` suffix is added when missing and preserved when present.
 *
 * 1. BigInt literal emission adds n to 10 but keeps the existing suffix on 20n.
 * 2. Literal 10n and 20n expectations express exactly one suffix independent of
 *    the constructor implementation.
 *
 * @evidence contracts/testing.md#behavioral-verification BigInt literal emission adds n to 10 but keeps the existing suffix on 20n.
 * @evidence contracts/testing.md#independent-expectations Literal 10n and 20n expectations express exactly one suffix independent of the constructor implementation.
 * @evidence contracts/testing.md#distinguishing-cases Unsuffixed and pre-suffixed inputs catch both omission and double suffixing.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_bigint_literal. Calls createBigIntLiteral and TsPrinter.print on each authored string input.
 */
export const test_bigint_literal = (): void => {
  TestValidator.equals(
    "plain",
    print(factory.createBigIntLiteral("10")),
    "10n",
  );
  TestValidator.equals(
    "suffixed",
    print(factory.createBigIntLiteral("20n")),
    "20n",
  );
};
