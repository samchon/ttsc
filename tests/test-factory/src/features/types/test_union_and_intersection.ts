import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "@ttsc/factory";

import { kw, print, ref } from "../../internal/helpers";

/**
 * Print union and intersection types inline.
 *
 * `string | number` and `A & B` when they fit on one line.
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
