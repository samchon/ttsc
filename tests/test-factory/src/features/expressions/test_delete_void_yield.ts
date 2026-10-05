import { TestValidator } from "@nestia/e2e";

import factory, { SyntaxKind } from "../../../../../packages/factory/src/index";
import { id, num, print, ref } from "../../internal/helpers";

/**
 * Verifies printing of `delete` / `void` / `yield` and an angle-bracket type
 * assertion.
 *
 * Optional yield operands and delegated yields must not share the wrong keyword
 * or asterisk branch.
 *
 * 1. Delete, void, yield, yield-star, bare yield and angle-bracket assertion
 *    preserve keyword/token variants.
 * 2. Exact literals specify each keyword, asterisk, optional operand and type
 *    assertion punctuation independently.
 *
 * @evidence contracts/testing.md#behavioral-verification Delete, void, yield, yield-star, bare yield and angle-bracket assertion preserve keyword/token variants.
 * @evidence contracts/testing.md#independent-expectations Exact literals specify each keyword, asterisk, optional operand and type assertion punctuation independently.
 * @evidence contracts/testing.md#distinguishing-cases Operand-present versus bare yield, delegated versus ordinary yield and unrelated keyword expressions prevent shared-branch token loss.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_delete_void_yield. Calls createDeleteExpression/createVoidExpression/createYieldExpression/createTypeAssertion and print.
 */
export const test_delete_void_yield = (): void => {
  TestValidator.equals(
    "delete",
    print(
      factory.createDeleteExpression(
        factory.createPropertyAccessExpression(id("obj"), "x"),
      ),
    ),
    "delete obj.x",
  );
  TestValidator.equals(
    "void",
    print(factory.createVoidExpression(num("0"))),
    "void 0",
  );
  TestValidator.equals(
    "yield",
    print(factory.createYieldExpression(undefined, id("v"))),
    "yield v",
  );
  TestValidator.equals(
    "yield*",
    print(
      factory.createYieldExpression(
        factory.createToken(SyntaxKind.AsteriskToken),
        factory.createCallExpression(id("gen"), undefined, []),
      ),
    ),
    "yield* gen()",
  );
  TestValidator.equals(
    "yield bare",
    print(factory.createYieldExpression(undefined, undefined)),
    "yield",
  );
  TestValidator.equals(
    "type assertion",
    print(factory.createTypeAssertion(ref("T"), id("value"))),
    "<T>value",
  );
};
