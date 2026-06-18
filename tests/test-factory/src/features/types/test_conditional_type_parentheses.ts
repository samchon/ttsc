import { TestValidator } from "@nestia/e2e";
import factory from "@ttsc/factory";

import { print, ref } from "../../internal/helpers";

/**
 * Verifies conditional type parenthesizer: wraps check and extends operands.
 *
 * A function, constructor, or conditional type in the check position would be
 * parsed as the conditional's own syntax without parentheses. A nested
 * conditional in the extends position has the same ambiguity.
 *
 * 1. Use a function type as the outer conditional check type.
 * 2. Use another conditional type as the outer extends type.
 * 3. Assert both operands are wrapped before `extends`.
 */
export const test_conditional_type_parentheses = (): void => {
  TestValidator.equals(
    "function check type",
    print(
      factory.createConditionalTypeNode(
        factory.createFunctionTypeNode(undefined, [], ref("R")),
        ref("Fn"),
        ref("Yes"),
        ref("No"),
      ),
    ),
    "(() => R) extends Fn ? Yes : No",
  );
  TestValidator.equals(
    "conditional extends type",
    print(
      factory.createConditionalTypeNode(
        ref("T"),
        factory.createConditionalTypeNode(
          ref("A"),
          ref("B"),
          ref("C"),
          ref("D"),
        ),
        ref("Yes"),
        ref("No"),
      ),
    ),
    "T extends (A extends B ? C : D) ? Yes : No",
  );
};
