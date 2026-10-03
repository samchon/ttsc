import { TestValidator } from "@nestia/e2e";
import factory from "../../../../../packages/factory/src/index";

import { print } from "../../internal/helpers";

/**
 * Verifies printing of a {@link factory.createPrivateIdentifier|private identifier}.
 *
 * A leading `#` is added when missing and preserved when already present, so
 * both `createPrivateIdentifier("secret")` and `("#kept")` round-trip
 * correctly.
 *
 * 1. Private identifier printing adds # when absent and preserves an existing #.
 * 2. The independent #secret and #kept expectations require exactly one private prefix.
 *
 * @evidence contracts/testing.md#behavioral-verification Private identifier printing adds # when absent and preserves an existing #.
 * @evidence contracts/testing.md#independent-expectations The independent #secret and #kept expectations require exactly one private prefix.
 * @evidence contracts/testing.md#distinguishing-cases Unprefixed and already-prefixed inputs catch both missing and doubled markers.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_private_identifier. Calls createPrivateIdentifier then TsPrinter.print directly.
 */
export const test_private_identifier = (): void => {
  TestValidator.equals(
    "added #",
    print(factory.createPrivateIdentifier("secret")),
    "#secret",
  );
  TestValidator.equals(
    "kept #",
    print(factory.createPrivateIdentifier("#kept")),
    "#kept",
  );
};
