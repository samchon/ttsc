import { TestValidator } from "@nestia/e2e";
import factory from "../../../../../packages/factory/src/index";

import { num, print } from "../../internal/helpers";

/**
 * Verifies printing of {@link factory.createNumericLiteral|numeric literals}.
 *
 * Integral and decimal text inputs render to their textual form.
 *
 * 1. Integral and decimal textual numeric literals retain 42 and 3.14.
 * 2. Exact literal 42 and 3.14 expectations pin the supplied lexical values; this case does not exercise number-valued constructor inputs.
 *
 * @evidence contracts/testing.md#behavioral-verification Integral and decimal textual numeric literals retain 42 and 3.14.
 * @evidence contracts/testing.md#independent-expectations Exact literal 42 and 3.14 expectations pin the supplied lexical values; this case does not exercise number-valued constructor inputs.
 * @evidence contracts/testing.md#distinguishing-cases Integer and decimal spellings distinguish truncation or coercion; negative numeric type syntax belongs to negative_literal_type.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_numeric_literal. Calls createNumericLiteral with string inputs and TsPrinter.print directly.
 */
export const test_numeric_literal = (): void => {
  TestValidator.equals("string", print(num("42")), "42");
  TestValidator.equals(
    "number",
    print(factory.createNumericLiteral(String(3.14))),
    "3.14",
  );
};
