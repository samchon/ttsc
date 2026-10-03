import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "../../../../../packages/factory/src/index";

import { kw, print, ref } from "../../internal/helpers";

/**
 * Verifies printing of union and intersection types inline.
 *
 * `string | number` and `A & B` when they fit on one line.
 *
 * 1. Inline unions and intersections retain their different | and & operators.
 * 2. Literal string | number and A & B independently specify operand order and operator spelling.
 *
 * @evidence contracts/testing.md#behavioral-verification Inline unions and intersections retain their different | and & operators.
 * @evidence contracts/testing.md#independent-expectations Literal string | number and A & B independently specify operand order and operator spelling.
 * @evidence contracts/testing.md#distinguishing-cases Two-element union versus intersection is the simple control for nested/broken binary type cases.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_union_and_intersection. Calls createUnionTypeNode/createIntersectionTypeNode and print directly.
 */
export const test_union_and_intersection = (): void => {
  TestValidator.equals(
    "union",
    print(
      factory.createUnionTypeNode([
        kw(SyntaxKind.StringKeyword),
        kw(SyntaxKind.NumberKeyword),
      ]),
    ),
    "string | number",
  );
  TestValidator.equals(
    "intersection",
    print(factory.createIntersectionTypeNode([ref("A"), ref("B")])),
    "A & B",
  );
};
