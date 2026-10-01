import { TestValidator } from "@nestia/e2e";
import factory from "../../../../../packages/factory/src/index";

import { id, num, print } from "../../internal/helpers";

/**
 * Verifies printing of a `switch` statement with a `case` and a `default` clause.
 *
 * The case block indents each clause, and each clause indents its statements,
 * producing the canonical nested layout.
 *
 * 1. Switch printing preserves case and default clause ordering and nested indentation.
 * 2. The independent complete switch source fixes discriminator, case literal and statements.
 *
 * @evidence contracts/testing.md#behavioral-verification Switch printing preserves case and default clause ordering and nested indentation.
 * @evidence contracts/testing.md#independent-expectations The independent complete switch source fixes discriminator, case literal and statements.
 * @evidence contracts/testing.md#distinguishing-cases Case and default clauses coexist, catching token substitution or body/order loss within the same case block.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_switch. Calls createSwitchStatement/createCaseBlock/createCaseClause/createDefaultClause then print.
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
