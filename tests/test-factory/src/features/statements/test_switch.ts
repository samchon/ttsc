import { TestValidator } from "@nestia/e2e";
import factory from "@ttsc/factory";

import { id, num, print } from "../../internal/helpers";

/**
 * Print a `switch` statement with a `case` and a `default` clause.
 *
 * The case block indents each clause, and each clause indents its statements,
 * producing the canonical nested layout.
 */
export const test_switch = (): void => {
  TestValidator.equals(
    "switch",
    print(
      factory.createSwitchStatement(
        id("x"),
        factory.createCaseBlock([
          factory.createCaseClause(num("1"), [factory.createBreakStatement()]),
          factory.createDefaultClause([factory.createBreakStatement()]),
        ]),
      ),
    ),
    [
      "switch (x) {",
      "  case 1:",
      "    break;",
      "  default:",
      "    break;",
      "}",
    ].join("\n"),
  );
};
