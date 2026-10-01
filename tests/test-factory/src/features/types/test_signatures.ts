import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "../../../../../packages/factory/src/index";

import { kw, param, print, ref } from "../../internal/helpers";

/**
 * Verifies printing of call and construct signatures inside a type literal.
 *
 * `{ (a: number): string; new (): T }` — a callable plus newable object type.
 *
 * 1. A type literal retains both call and construct signatures with their parameter and result types.
 * 2. Literal { (a: number): string; new (): T } independently specifies call/new distinction and separator.
 *
 * @evidence contracts/testing.md#behavioral-verification A type literal retains both call and construct signatures with their parameter and result types.
 * @evidence contracts/testing.md#independent-expectations Literal { (a: number): string; new (): T } independently specifies call/new distinction and separator.
 * @evidence contracts/testing.md#distinguishing-cases Parameter-bearing callable versus empty-parameter construct signature detects confusing their shared type-literal context.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_signatures. Calls createCallSignature/createConstructSignature/createTypeLiteralNode and print.
 */
export const test_signatures = (): void => {
  TestValidator.equals(
    "call & construct",
    print(
      factory.createTypeLiteralNode([
        factory.createCallSignature(
          undefined,
          [param("a", kw(SyntaxKind.NumberKeyword))],
          kw(SyntaxKind.StringKeyword),
        ),
        factory.createConstructSignature(undefined, [], ref("T")),
      ]),
    ),
    "{ (a: number): string; new (): T }",
  );
};
