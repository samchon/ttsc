import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind, addSyntheticLeadingComment } from "../../../../../packages/factory/src/index";
import { kw, print } from "../../internal/helpers";
import { alias } from "../../internal/commentFixtures";

/**
 * Verifies multiple leading comments stack in attachment order.
 *
 * Successive attachments must preserve their insertion order and retain both lines.
 *
 * 1. Two SingleLine comments print in attachment order before the ID alias.
 * 2. Independent first/second literal lines distinguish preservation of both comments from reversal or overwrite.
 *
 * @evidence contracts/testing.md#behavioral-verification Two SingleLine comments print in attachment order before the ID alias.
 * @evidence contracts/testing.md#independent-expectations Independent first/second literal lines distinguish preservation of both comments from reversal or overwrite.
 * @evidence contracts/testing.md#distinguishing-cases The two-comment boundary complements the single leading comment case; both use false newline flags.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_multiple_leading_comments. Calls alias, attaches two leading comments, and prints that same node once in the unit process.
 */
export const test_multiple_leading_comments = (): void => {
  const node = alias();
  addSyntheticLeadingComment(
    node,
    SyntaxKind.SingleLineCommentTrivia,
    " first",
    false,
  );
  addSyntheticLeadingComment(
    node,
    SyntaxKind.SingleLineCommentTrivia,
    " second",
    false,
  );
  TestValidator.equals(
    "multiple leading comments",
    print(node),
    ["// first", "// second", "type ID = string;"].join("\n"),
  );
};
