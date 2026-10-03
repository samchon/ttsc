import assert from "node:assert/strict";
import factory, {
  SyntaxKind,
  setSyntheticTrailingComments,
} from "../../../../../packages/factory/src/index";
import { print } from "../../internal/helpers";

/**
 * Verifies trailing comments honor independent leading and trailing line boundaries.
 *
 * A single-line comment must end its line even when its flag is false; multiline
 * comments can independently start and end a new line.
 *
 * 1. Print multiline comments with neither, each, and both newline flags.
 * 2. Contrast single-line comments with false and true trailing flags.
 * 3. Compare exact text while preserving the identifier before the comment.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls setSyntheticTrailingComments and TsPrinter.print for each authored comment on x. Exact output distinguishes ignored leading flags, ignored trailing flags and single-line comments that fail to terminate.
 * @evidence contracts/testing.md#independent-expectations Authored source literals follow the documented independent newline flags and mandatory termination of line-comment syntax. The layout contract removes trailing spaces at a line break; the printer does not supply expected output.
 * @evidence contracts/testing.md#distinguishing-cases Multiline false/false, true/false, false/true and true/true cover both independent booleans; single-line false and true must both end a line. The existing trailing_comment case owns declaration-semicolon placement.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers this matching source-unit feature and invokes both factory operations in the same Node process without installation, native compilation or product hosts.
 */
export const test_trailing_comment_line_boundaries = (): void => {
  for (const [kind, before, after, expected] of [
    [SyntaxKind.MultiLineCommentTrivia, false, false, "x /* c */"],
    [SyntaxKind.MultiLineCommentTrivia, true, false, "x\n/* c */"],
    [SyntaxKind.MultiLineCommentTrivia, false, true, "x /* c */\n"],
    [SyntaxKind.MultiLineCommentTrivia, true, true, "x\n/* c */\n"],
    [SyntaxKind.SingleLineCommentTrivia, false, false, "x // c\n"],
    [SyntaxKind.SingleLineCommentTrivia, true, true, "x\n// c\n"],
  ] as const) {
    const node = factory.createIdentifier("x");
    setSyntheticTrailingComments(node, [{
      kind,
      text: " c ",
      hasLeadingNewLine: before,
      hasTrailingNewLine: after,
    }]);
    assert.equal(print(node), expected, `${kind}/${before}/${after}`);
  }
};
