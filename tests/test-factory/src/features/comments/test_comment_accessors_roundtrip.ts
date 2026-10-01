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
 * Verifies get / set accessors round-trip and clear synthesized comments.
 *
 * Matching comment counts alone cannot detect changed kind, text or order, and both clear representations must return absent state.
 *
 * 1. Synthetic comment setters/getters preserve leading a/b order, trailing z kind/text, and clear both sides.
 * 2. Independent payload arrays specify MultiLine versus SingleLine kinds and exact texts; counts alone cannot certify the content.
 *
 * @evidence contracts/testing.md#behavioral-verification Synthetic comment setters/getters preserve leading a/b order, trailing z kind/text, and clear both sides.
 * @evidence contracts/testing.md#independent-expectations Independent payload arrays specify MultiLine versus SingleLine kinds and exact texts; counts alone cannot certify the content.
 * @evidence contracts/testing.md#distinguishing-cases Absent initial state, two leading comments, one trailing comment, undefined leading clear and empty-array trailing clear exercise separate transitions.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_comment_accessors_roundtrip. Calls get/setSyntheticLeadingComments and get/setSyntheticTrailingComments on one in-process identifier.
 */
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

  TestValidator.equals("leading payload and order", getSyntheticLeadingComments(node), [
    { kind: SyntaxKind.MultiLineCommentTrivia, text: " a " },
    { kind: SyntaxKind.MultiLineCommentTrivia, text: " b " },
  ]);
  TestValidator.equals("trailing payload", getSyntheticTrailingComments(node), [
    { kind: SyntaxKind.SingleLineCommentTrivia, text: " z" },
  ]);

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
