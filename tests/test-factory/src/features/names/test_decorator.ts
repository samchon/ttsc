import { TestValidator } from "@nestia/e2e";
import factory from "../../../../../packages/factory/src/index";

import { id, print } from "../../internal/helpers";

/**
 * Verifies printing of a {@link factory.createDecorator|decorator} expression.
 *
 * A standalone decorator renders with its leading `@`.
 *
 * 1. The identifier decorator prints @deco rather than bare deco.
 * 2. Literal @deco is the decorator token plus the supplied identifier.
 *
 * @evidence contracts/testing.md#behavioral-verification The identifier decorator prints @deco rather than bare deco.
 * @evidence contracts/testing.md#independent-expectations Literal @deco is the decorator token plus the supplied identifier.
 * @evidence contracts/testing.md#distinguishing-cases This owns the simple identifier decorator; tighter expression operands are covered by expression_context_parentheses and optional_chain_operand_parentheses.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_decorator. Calls createDecorator around createIdentifier then TsPrinter.print.
 */
export const test_decorator = (): void => {
  TestValidator.equals(
    "decorator",
    print(factory.createDecorator(id("deco"))),
    "@deco",
  );
};
