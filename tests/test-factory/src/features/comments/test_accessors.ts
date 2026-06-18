import { TestValidator } from "@nestia/e2e";
import factory, {
  SyntaxKind,
  addSyntheticLeadingComment,
  getSyntheticLeadingComments,
  getSyntheticTrailingComments,
  setSyntheticLeadingComments,
  setSyntheticTrailingComments,
} from "@ttsc/factory";

import { print, ref } from "../../internal/helpers";

/** `addSyntheticLeadingComment` returns the same node, enabling call chaining. */
export const test_add_comment_returns_node = (): void => {
  const node = factory.createIdentifier("x");
  const returned = addSyntheticLeadingComment(
    node,
    SyntaxKind.MultiLineCommentTrivia,
    " c ",
    false,
  );
  TestValidator.equals("add returns node", returned === node, true);
};

/** Get / set accessors round-trip and clear synthesized comments. */
export const test_comment_accessors_roundtrip = (): void => {
  const node = factory.createIdentifier("x");
  TestValidator.equals(
    "leading empty",
    getSyntheticLeadingComments(node),
    undefined,
  );
  TestValidator.equals(
    "trailing empty",
    getSyntheticTrailingComments(node),
    undefined,
  );

  setSyntheticLeadingComments(node, [
    { kind: SyntaxKind.MultiLineCommentTrivia, text: " a " },
    { kind: SyntaxKind.MultiLineCommentTrivia, text: " b " },
  ]);
  TestValidator.equals(
    "leading length",
    getSyntheticLeadingComments(node)?.length,
    2,
  );

  setSyntheticTrailingComments(node, [
    { kind: SyntaxKind.SingleLineCommentTrivia, text: " z" },
  ]);
  TestValidator.equals(
    "trailing length",
    getSyntheticTrailingComments(node)?.length,
    1,
  );

  setSyntheticLeadingComments(node, undefined);
  setSyntheticTrailingComments(node, []);
  TestValidator.equals(
    "leading cleared",
    getSyntheticLeadingComments(node),
    undefined,
  );
  TestValidator.equals(
    "trailing cleared",
    getSyntheticTrailingComments(node),
    undefined,
  );
};

/** Nodes without synthesized comments print exactly as before (no regression). */
export const test_uncommented_node_unchanged = (): void => {
  TestValidator.equals("uncommented node", print(ref("X")), "X");
};
