import { TestValidator } from "@nestia/e2e";
import factory from "../../../../../packages/factory/src/index";

import { id, print } from "../../internal/helpers";

/**
 * Print a {@link factory.createDecorator|decorator} expression.
 *
 * A standalone decorator renders with its leading `@`.
 */
export const test_decorator = (): void => {
  TestValidator.equals(
    "decorator",
    print(factory.createDecorator(id("deco"))),
    "@deco",
  );
};
