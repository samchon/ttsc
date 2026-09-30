import { TestValidator } from "@nestia/e2e";

import { id, print } from "../../internal/helpers";

/**
 * Print a bare {@link factory.createIdentifier|identifier}.
 *
 * The simplest possible node: an identifier renders to exactly its text with no
 * decoration.
 */
export const test_identifier = (): void => {
  TestValidator.equals("identifier", print(id("value")), "value");
};
