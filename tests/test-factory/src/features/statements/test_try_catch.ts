import { TestValidator } from "@nestia/e2e";

import factory from "../../../../../packages/factory/src/index";
import { print } from "../../internal/helpers";

/**
 * Verifies printing of `try` / `catch` / `finally`, including a catch clause
 * without a binding.
 *
 * Catch and finally are independent optional slots; a missing catch must not
 * remove a supplied finalizer or introduce catch parentheses.
 *
 * 1. Try/catch/finally and bindingless catch preserve block order and optional
 *    catch variable.
 * 2. The authored complete statement literals independently specify catch
 *    parentheses and finally placement.
 *
 * @evidence contracts/testing.md#behavioral-verification Try/catch/finally and bindingless catch preserve block order and optional catch variable.
 * @evidence contracts/testing.md#independent-expectations The authored complete statement literals independently specify catch parentheses and finally placement.
 * @evidence contracts/testing.md#distinguishing-cases Bound catch with finally, bindingless catch without finally and finally without catch distinguish omitted variable and the two independent optional statement slots.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_try_catch. Calls createTryStatement/createCatchClause and TsPrinter.print directly.
 */
export const test_try_catch = (): void => {
  TestValidator.equals(
    "finally without catch",
    print(
      factory.createTryStatement(
        factory.createBlock([]),
        undefined,
        factory.createBlock([]),
      ),
    ),
    "try {} finally {}",
  );
  TestValidator.equals(
    "try catch finally",
    print(
      factory.createTryStatement(
        factory.createBlock([], true),
        factory.createCatchClause("e", factory.createBlock([], true)),
        factory.createBlock([], true),
      ),
    ),
    "try {} catch (e) {} finally {}",
  );
  TestValidator.equals(
    "catch without binding",
    print(
      factory.createTryStatement(
        factory.createBlock([], true),
        factory.createCatchClause(undefined, factory.createBlock([], true)),
        undefined,
      ),
    ),
    "try {} catch {}",
  );
};
