import { TestValidator } from "@nestia/e2e";

import { id, print } from "../../internal/helpers";

/**
 * Verifies printing of a bare {@link factory.createIdentifier|identifier}.
 *
 * The simplest possible node: an identifier renders to exactly its text with no
 * decoration.
 *
 * 1. The factory identifier value prints exactly value.
 * 2. The literal supplied identifier is independent of the printer and catches unwanted quoting or token loss.
 *
 * @evidence contracts/testing.md#behavioral-verification The factory identifier value prints exactly value.
 * @evidence contracts/testing.md#independent-expectations The literal supplied identifier is independent of the printer and catches unwanted quoting or token loss.
 * @evidence contracts/testing.md#distinguishing-cases This bare identifier control complements qualified_name and private_identifier, which own punctuation and prefixes.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_identifier. Calls createIdentifier and TsPrinter.print directly.
 */
export const test_identifier = (): void => {
  TestValidator.equals("identifier", print(id("value")), "value");
};
