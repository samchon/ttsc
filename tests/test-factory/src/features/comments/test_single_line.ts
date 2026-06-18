import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind, addSyntheticLeadingComment } from "@ttsc/factory";

import { kw, print } from "../../internal/helpers";

const alias = () =>
  factory.createTypeAliasDeclaration(
    undefined,
    "ID",
    undefined,
    kw(SyntaxKind.StringKeyword),
  );

/**
 * A single-line leading comment.
 *
 * `SingleLineCommentTrivia` always terminates its line, regardless of the
 * `hasTrailingNewLine` argument, since `//` cannot share a line with the node.
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

/** Multiple leading comments stack in attachment order. */
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
