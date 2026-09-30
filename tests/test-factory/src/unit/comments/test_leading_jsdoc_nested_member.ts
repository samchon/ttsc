import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind, addSyntheticLeadingComment } from "../../../../../packages/factory/src/index";
import { kw, print } from "../../internal/helpers";
import { jsdocFixture } from "./test_leading_jsdoc";

const { jsdoc } = jsdocFixture;

/**
 * Verifies attachment of a JSDoc comment to a member nested inside an interface.
 *
 * The embedded newlines must re-indent with the member, so the comment lines
 * sit at the member's indentation rather than the file column.
 *
 * 1. JSDoc attached to interface property id stays nested and indented with the member.
 * 2. The complete interface I output literal specifies two-space comment/member indentation and the id: string payload.
 *
 * @evidence contracts/testing.md#behavioral-verification JSDoc attached to interface property id stays nested and indented with the member.
 * @evidence contracts/testing.md#independent-expectations The complete interface I output literal specifies two-space comment/member indentation and the id: string payload.
 * @evidence contracts/testing.md#distinguishing-cases Nested member attachment distinguishes this case from top-level JSDoc; the interface wrapper must not steal the comment.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_leading_jsdoc_nested_member. Constructs the property and interface, attaches its comment, and runs TsPrinter.print in process.
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
