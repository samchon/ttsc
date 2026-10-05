import { TestValidator } from "@nestia/e2e";

import factory, {
  SyntaxKind,
  TsPrinter,
} from "../../../../../packages/factory/src/index";
import { kw } from "../../internal/helpers";

/**
 * Verifies a wide union breaks with leading `|` operators.
 *
 * Under `printWidth: 20` the alias body moves to the next line and each member
 * gets a leading pipe.
 *
 * 1. A width20 union alias moves members to separate lines with leading |
 *    operators.
 * 2. Explicit type U multiline source independently specifies leading operators,
 *    member order and final semicolon.
 *
 * @evidence contracts/testing.md#behavioral-verification A width20 union alias moves members to separate lines with leading | operators.
 * @evidence contracts/testing.md#independent-expectations Explicit type U multiline source independently specifies leading operators, member order and final semicolon.
 * @evidence contracts/testing.md#distinguishing-cases Three-member broken union complements inline unions and broken nested intersections, preventing dangling or dropped operators.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_union_break. Calls createTypeAliasDeclaration/createUnionTypeNode and narrow TsPrinter.print.
 */
export const test_union_break = (): void => {
  const narrow = new TsPrinter({ printWidth: 20 });
  TestValidator.equals(
    "union break",
    narrow.print(
      factory.createTypeAliasDeclaration(
        undefined,
        "U",
        undefined,
        factory.createUnionTypeNode([
          kw(SyntaxKind.StringKeyword),
          kw(SyntaxKind.NumberKeyword),
          kw(SyntaxKind.BooleanKeyword),
        ]),
      ),
    ),
    ["type U =", "  | string", "  | number", "  | boolean;"].join("\n"),
  );
};
