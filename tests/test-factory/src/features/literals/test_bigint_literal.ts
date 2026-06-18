import { TestValidator } from "@nestia/e2e";
import factory from "@ttsc/factory";

import { print } from "../../internal/helpers";

/**
 * Print {@link factory.createBigIntLiteral|BigInt literals}.
 *
 * The trailing `n` suffix is added when missing and preserved when present.
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
