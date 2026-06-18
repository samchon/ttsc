import { TestValidator } from "@nestia/e2e";
import factory, {
  SyntaxKind,
  addSyntheticLeadingComment,
  addSyntheticTrailingComment,
} from "@ttsc/factory";

import { kw, param, print } from "../../internal/helpers";

const alias = () =>
  factory.createTypeAliasDeclaration(
    undefined,
    "ID",
    undefined,
    kw(SyntaxKind.StringKeyword),
  );

/**
 * An inline multi-line leading comment without a trailing newline.
 *
 * `/* *\/` comments with `hasTrailingNewLine` falsey are separated from the
 * node by a single space instead of a line break.
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

/** A trailing multi-line comment renders after the node, space-separated. */
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

/** Leading and trailing comments coexist on one node. */
export const test_leading_and_trailing_comment = (): void => {
  const node = alias();
  addSyntheticLeadingComment(
    node,
    SyntaxKind.MultiLineCommentTrivia,
    " before ",
    false,
  );
  addSyntheticTrailingComment(
    node,
    SyntaxKind.MultiLineCommentTrivia,
    " after ",
  );
  TestValidator.equals(
    "leading and trailing comment",
    print(node),
    "/* before */ type ID = string; /* after */",
  );
};
