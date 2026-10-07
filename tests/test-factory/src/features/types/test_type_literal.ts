import { TestValidator } from "@nestia/e2e";

import factory, { SyntaxKind } from "../../../../../packages/factory/src/index";
import { kw, print } from "../../internal/helpers";

/**
 * Verifies printing of an inline
 * {@link factory.createTypeLiteralNode|object type}.
 *
 * A single-member type literal stays on one line as `{ x: number }`.
 *
 * 1. A single x: number type property stays inline inside object-type braces.
 * 2. Literal { x: number } independently fixes property punctuation and inline
 *    spacing.
 *
 * @evidence contracts/testing.md#behavioral-verification A single x: number type property stays inline inside object-type braces.
 * @evidence contracts/testing.md#independent-expectations Literal { x: number } independently fixes property punctuation and inline spacing.
 * @evidence contracts/testing.md#distinguishing-cases This singleton inline boundary complements interface multi-member and width-break tests; no empty/multiline behavior is claimed here.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_type_literal. Calls createPropertySignature/createTypeLiteralNode and print.
 */
export const test_type_literal = (): void => {
  TestValidator.equals(
    "inline",
    print(
      factory.createTypeLiteralNode([
        factory.createPropertySignature(
          undefined,
          "x",
          undefined,
          kw(SyntaxKind.NumberKeyword),
        ),
      ]),
    ),
    "{ x: number }",
  );
};
