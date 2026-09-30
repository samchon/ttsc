import { TestValidator } from "@nestia/e2e";
import factory from "../../../../../packages/factory/src/index";

import { id, print } from "../../internal/helpers";

/**
 * Verifies printing of the remaining simple statements.
 *
 * A labeled block, a `with` statement, `debugger`, and the empty statement.
 *
 * 1. Labeled blocks, with, debugger and empty statements retain their distinct keyword/delimiter syntax.
 * 2. Explicit label/with/debugger/semicolon literals derive from statement grammar independently.
 *
 * @evidence contracts/testing.md#behavioral-verification Labeled blocks, with, debugger and empty statements retain their distinct keyword/delimiter syntax.
 * @evidence contracts/testing.md#independent-expectations Explicit label/with/debugger/semicolon literals derive from statement grammar independently.
 * @evidence contracts/testing.md#distinguishing-cases A labeled wrapper and keyword versus empty statements exercise separate emit branches; runtime strict-mode legality of with is not asserted.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_labeled_with_misc. Calls createLabeledStatement/createWithStatement/createDebuggerStatement/createEmptyStatement and print.
 */
export const test_labeled_with_misc = (): void => {
  TestValidator.equals(
    "labeled",
    print(
      factory.createLabeledStatement("block", factory.createBlock([], true)),
    ),
    "block: {}",
  );
  TestValidator.equals(
    "with",
    print(
      factory.createWithStatement(id("obj"), factory.createBlock([], true)),
    ),
    "with (obj) {}",
  );
  TestValidator.equals(
    "debugger",
    print(factory.createDebuggerStatement()),
    "debugger;",
  );
  TestValidator.equals("empty", print(factory.createEmptyStatement()), ";");
};
