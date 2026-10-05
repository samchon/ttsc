import { TestValidator } from "@nestia/e2e";

import factory, {
  SyntaxKind,
  addSyntheticLeadingComment,
  getSyntheticLeadingComments,
  getSyntheticTrailingComments,
  setSyntheticLeadingComments,
  setSyntheticTrailingComments,
} from "../../../../../packages/factory/src/index";
import { print, ref } from "../../internal/helpers";

/**
 * Verifies `addSyntheticLeadingComment` returns the same node, enabling call
 * chaining.
 *
 * Returning the same node alone would let a no-op adder pass; the attached
 * comment must also be visible.
 *
 * 1. AddSyntheticLeadingComment retains the identifier identity and print exposes
 *    its attached slash-star c star-slash comment.
 * 2. The x identifier and literal slash-star c star-slash x require both mutation
 *    and identity preservation; equality alone would miss a no-op.
 *
 * @evidence contracts/testing.md#behavioral-verification addSyntheticLeadingComment retains the identifier identity and print exposes its attached slash-star c star-slash comment.
 * @evidence contracts/testing.md#independent-expectations The x identifier and literal slash-star c star-slash x require both mutation and identity preservation; equality alone would miss a no-op.
 * @evidence contracts/testing.md#distinguishing-cases The returned-node check and printed comment distinguish chaining from attachment; clearing and empty state belong to comment_accessors_roundtrip.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_add_comment_returns_node. Directly calls addSyntheticLeadingComment and TsPrinter.print on an authored identifier.
 */
export const test_add_comment_returns_node = (): void => {
  const node = factory.createIdentifier("x");
  const returned = addSyntheticLeadingComment(
    node,
    SyntaxKind.MultiLineCommentTrivia,
    " c ",
    false,
  );
  TestValidator.equals("add returns node", returned === node, true);
  TestValidator.equals("added comment is observable", print(node), "/* c */ x");
};
