import { TestValidator } from "@nestia/e2e";
import factory from "../../../../../packages/factory/src/index";

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
 *
 * @evidence contracts/testing.md#behavioral-verification Function check types and conditional extends types are parenthesized so the outer conditional retains its intended operands.
 * @evidence contracts/testing.md#independent-expectations Literal (() => R) extends Fn and nested-conditional extends expectations encode TypeScript binding independently.
 * @evidence contracts/testing.md#distinguishing-cases Function check and conditional extends occupy different slots; bare reference branches remain unchanged.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_conditional_type_parentheses. Calls createConditionalTypeNode with function/conditional subtypes then print.
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
