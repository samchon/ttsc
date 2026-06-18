import { TestValidator } from "@nestia/e2e";
import factory from "@ttsc/factory";

import { print } from "../../internal/helpers";

/**
 * Print `try` / `catch` / `finally`, including a catch clause without a
 * binding.
 */
export const test_try_catch = (): void => {
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
