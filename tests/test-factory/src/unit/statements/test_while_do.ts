import { TestValidator } from "@nestia/e2e";
import factory from "../../../../../packages/factory/src/index";

import { id, print } from "../../internal/helpers";

/**
 * Verifies printing of `while` and `do...while` loops with empty bodies.
 *
 * Precondition and postcondition loops place the same condition at different syntax positions.
 *
 * 1. While and do-while retain their condition position and distinct terminating syntax around empty bodies.
 * 2. Literal while and do-while outputs independently specify keyword ordering and semicolon requirements.
 *
 * @evidence contracts/testing.md#behavioral-verification While and do-while retain their condition position and distinct terminating syntax around empty bodies.
 * @evidence contracts/testing.md#independent-expectations Literal while and do-while outputs independently specify keyword ordering and semicolon requirements.
 * @evidence contracts/testing.md#distinguishing-cases Precondition versus postcondition forms with the same empty body catch reuse of the wrong statement shape.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_while_do. Calls createWhileStatement/createDoStatement and print directly.
 */
export const test_while_do = (): void => {
  TestValidator.equals(
    "while",
    print(
      factory.createWhileStatement(id("ok"), factory.createBlock([], true)),
    ),
    "while (ok) {}",
  );
  TestValidator.equals(
    "do-while",
    print(factory.createDoStatement(factory.createBlock([], true), id("ok"))),
    "do {} while (ok);",
  );
};
