import { TestValidator } from "@nestia/e2e";

import factory, {
  SyntaxKind,
  addSyntheticLeadingComment,
} from "../../../../../packages/factory/src/index";
import { alias } from "../../internal/commentFixtures";
import { kw, print } from "../../internal/helpers";

/**
 * Verifies a single-line leading comment.
 *
 * `SingleLineCommentTrivia` always terminates its line, regardless of the
 * `hasTrailingNewLine` argument, since `//` cannot share a line with the node.
 *
 * 1. A SingleLine leading comment breaks before the type alias even when
 *    hasTrailingNewLine is false.
 * 2. Literal // an id alias followed by a newline and type ID = string; follows
 *    line-comment syntax, not the flag alone.
 *
 * @evidence contracts/testing.md#behavioral-verification A SingleLine leading comment breaks before the type alias even when hasTrailingNewLine is false.
 * @evidence contracts/testing.md#independent-expectations Literal // an id alias followed by a newline and type ID = string; follows line-comment syntax, not the flag alone.
 * @evidence contracts/testing.md#distinguishing-cases SingleLine false contrasts with inline multiline false and multiple leading comments, preventing accidental comment-out of the declaration.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_single_line_leading_comment. Calls alias, addSyntheticLeadingComment with SingleLineCommentTrivia, and TsPrinter.print.
 */
export const test_single_line_leading_comment = (): void => {
  TestValidator.equals(
    "single-line leading comment",
    print(
      addSyntheticLeadingComment(
        alias(),
        SyntaxKind.SingleLineCommentTrivia,
        " an id alias",
        false,
      ),
    ),
    ["// an id alias", "type ID = string;"].join("\n"),
  );
};
