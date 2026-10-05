import { TestValidator } from "@nestia/e2e";

import factory, {
  SyntaxKind,
  addSyntheticLeadingComment,
} from "../../../../../packages/factory/src/index";
import { jsdoc } from "../../internal/commentFixtures";
import { kw, print } from "../../internal/helpers";

/**
 * Verifies attachment of a multi-line JSDoc comment to a top-level declaration.
 *
 * Mirrors the legacy `ts.addSyntheticLeadingComment` with
 * {@link SyntaxKind.MultiLineCommentTrivia} and a trailing line break: the
 * comment prints on its own lines immediately above the node.
 *
 * 1. A newline-leading JSDoc block precedes the ID type alias with exact comment
 *    lines.
 * 2. The explicit The identifier. multiline source expectation fixes delimiters
 *    and line breaks independently of the jsdoc helper.
 *
 * @evidence contracts/testing.md#behavioral-verification A newline-leading JSDoc block precedes the ID type alias with exact comment lines.
 * @evidence contracts/testing.md#independent-expectations The explicit The identifier. multiline source expectation fixes delimiters and line breaks independently of the jsdoc helper.
 * @evidence contracts/testing.md#distinguishing-cases Top-level JSDoc complements nested-member indentation and the false-newline inline-leading control.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_leading_jsdoc_statement. Calls jsdoc, createTypeAliasDeclaration, addSyntheticLeadingComment and TsPrinter.print without a compiler host.
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
