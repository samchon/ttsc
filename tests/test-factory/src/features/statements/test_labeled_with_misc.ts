import { TestValidator } from "@nestia/e2e";
import factory from "@ttsc/factory";

import { id, print } from "../../internal/helpers";

/**
 * Print the remaining simple statements.
 *
 * A labeled block, a `with` statement, `debugger`, and the empty statement.
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
