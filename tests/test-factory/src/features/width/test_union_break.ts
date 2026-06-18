import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind, TsPrinter } from "@ttsc/factory";

import { kw } from "../../internal/helpers";

/**
 * A wide union breaks with leading `|` operators.
 *
 * Under `printWidth: 20` the alias body moves to the next line and each member
 * gets a leading pipe.
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
