import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind, addSyntheticLeadingComment } from "@ttsc/factory";

import { kw, print } from "../../internal/helpers";

/** The exact JSDoc body shape produced by codegen callers (`@nestia/migrate`). */
const jsdoc = (description: string): string =>
  ["*", ` * ${description}`, ""].join("\n");

/**
 * Attach a multi-line JSDoc comment to a top-level declaration.
 *
 * Mirrors the legacy `ts.addSyntheticLeadingComment` with
 * {@link SyntaxKind.MultiLineCommentTrivia} and a trailing line break: the
 * comment prints on its own lines immediately above the node.
 */
export const test_leading_jsdoc_statement = (): void => {
  const node = addSyntheticLeadingComment(
    factory.createTypeAliasDeclaration(
      undefined,
      "ID",
      undefined,
      kw(SyntaxKind.StringKeyword),
    ),
    SyntaxKind.MultiLineCommentTrivia,
    jsdoc("The identifier."),
    true,
  );
  TestValidator.equals(
    "leading jsdoc on statement",
    print(node),
    ["/**", " * The identifier.", "*/", "type ID = string;"].join("\n"),
  );
};

/**
 * Attach a JSDoc comment to a member nested inside an interface.
 *
 * The embedded newlines must re-indent with the member, so the comment lines
 * sit at the member's indentation rather than the file column.
 */
export const test_leading_jsdoc_nested_member = (): void => {
  const property = addSyntheticLeadingComment(
    factory.createPropertySignature(
      undefined,
      "id",
      undefined,
      kw(SyntaxKind.StringKeyword),
    ),
    SyntaxKind.MultiLineCommentTrivia,
    jsdoc("The id."),
    true,
  );
  TestValidator.equals(
    "leading jsdoc on nested member",
    print(
      factory.createInterfaceDeclaration(undefined, "I", undefined, undefined, [
        property,
      ]),
    ),
    [
      "interface I {",
      "  /**",
      "   * The id.",
      "  */",
      "  id: string;",
      "}",
    ].join("\n"),
  );
};
