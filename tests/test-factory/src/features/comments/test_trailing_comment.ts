import { TestValidator } from "@nestia/e2e";
import factory, {
  SyntaxKind,
  addSyntheticLeadingComment,
  addSyntheticTrailingComment,
} from "../../../../../packages/factory/src/index";
import { kw, param, print } from "../../internal/helpers";
import { inlineCommentFixture } from "./test_inline_and_trailing";

const { alias } = inlineCommentFixture;

/**
 * Verifies a trailing multi-line comment renders after the node, space-separated.
 *
 * A trailing attachment must stay after the declaration semicolon rather than being treated as a leading comment.
 *
 * 1. A multiline trailing comment follows the semicolon of the ID type alias.
 * 2. Literal type ID = string; slash-star trailing star-slash independently fixes statement/comment ordering and delimiter spacing.
 *
 * @evidence contracts/testing.md#behavioral-verification A multiline trailing comment follows the semicolon of the ID type alias.
 * @evidence contracts/testing.md#independent-expectations Literal type ID = string; slash-star trailing star-slash independently fixes statement/comment ordering and delimiter spacing.
 * @evidence contracts/testing.md#distinguishing-cases Trailing-only attachment complements inline_leading_comment and the both-sides case; it must not move before the declaration.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_trailing_comment. Calls the shared alias constructor, addSyntheticTrailingComment and TsPrinter.print directly.
 */
export const test_trailing_comment = (): void => {
  TestValidator.equals(
    "trailing comment",
    print(
      addSyntheticTrailingComment(
        alias(),
        SyntaxKind.MultiLineCommentTrivia,
        " trailing ",
      ),
    ),
    "type ID = string; /* trailing */",
  );
};
