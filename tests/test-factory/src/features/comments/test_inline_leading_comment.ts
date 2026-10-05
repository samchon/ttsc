import { TestValidator } from "@nestia/e2e";

import factory, {
  SyntaxKind,
  addSyntheticLeadingComment,
  addSyntheticTrailingComment,
} from "../../../../../packages/factory/src/index";
import { kw, param, print } from "../../internal/helpers";

/**
 * Verifies an inline multi-line leading comment without a trailing newline.
 *
 * `slash-star *\/` comments with `hasTrailingNewLine` falsey are separated from
 * the node by a single space instead of a line break.
 *
 * 1. A non-newline multiline leading comment stays inline before the x: number
 *    parameter.
 * 2. The exact slash-star note star-slash x: number expectation specifies the
 *    comment delimiters, spacing and unmodified parameter.
 *
 * @evidence contracts/testing.md#behavioral-verification A non-newline multiline leading comment stays inline before the x: number parameter.
 * @evidence contracts/testing.md#independent-expectations The exact slash-star note star-slash x: number expectation specifies the comment delimiters, spacing and unmodified parameter.
 * @evidence contracts/testing.md#distinguishing-cases The false trailing-newline flag distinguishes inline attachment from leading_jsdoc_statement and single_line_leading_comment.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_inline_leading_comment. Calls createParameterDeclaration, addSyntheticLeadingComment and TsPrinter.print through the discoverable unit export.
 */
export const test_inline_leading_comment = (): void => {
  TestValidator.equals(
    "inline leading comment",
    print(
      addSyntheticLeadingComment(
        param("x", kw(SyntaxKind.NumberKeyword)),
        SyntaxKind.MultiLineCommentTrivia,
        " note ",
        false,
      ),
    ),
    "/* note */ x: number",
  );
};
