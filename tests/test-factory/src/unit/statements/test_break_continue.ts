import { TestValidator } from "@nestia/e2e";
import factory from "../../../../../packages/factory/src/index";

import { print } from "../../internal/helpers";

/**
 * Verifies printing of `break` / `continue`, both bare and with a target label.
 *
 * Label omission and keyword choice are independent statement decisions; neither may inherit the previous variant.
 *
 * 1. Break and continue statements retain optional label names and terminating semicolons.
 * 2. Literal break;, continue; and labeled variants specify the grammar independently.
 *
 * @evidence contracts/testing.md#behavioral-verification Break and continue statements retain optional label names and terminating semicolons.
 * @evidence contracts/testing.md#independent-expectations Literal break;, continue; and labeled variants specify the grammar independently.
 * @evidence contracts/testing.md#distinguishing-cases Absent versus present labels across two keywords catches omission, unconditional labeling or keyword swapping.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_break_continue. Calls createBreakStatement/createContinueStatement and print directly.
 */
export const test_break_continue = (): void => {
  TestValidator.equals(
    "break",
    print(factory.createBreakStatement()),
    "break;",
  );
  TestValidator.equals(
    "break label",
    print(factory.createBreakStatement("outer")),
    "break outer;",
  );
  TestValidator.equals(
    "continue",
    print(factory.createContinueStatement()),
    "continue;",
  );
  TestValidator.equals(
    "continue label",
    print(factory.createContinueStatement("outer")),
    "continue outer;",
  );
};
