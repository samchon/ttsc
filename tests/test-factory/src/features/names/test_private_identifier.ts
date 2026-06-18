import { TestValidator } from "@nestia/e2e";
import factory from "@ttsc/factory";

import { print } from "../../internal/helpers";

/**
 * Print a {@link factory.createPrivateIdentifier|private identifier}.
 *
 * A leading `#` is added when missing and preserved when already present, so
 * both `createPrivateIdentifier("secret")` and `("#kept")` round-trip
 * correctly.
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
