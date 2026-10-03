package evidence

import (
  "testing"
)

/**
 * Verifies a line comment above a documented declaration is reported.
 *
 * A documentation node's reported start is its full start, so its span reaches
 * back to the previous token and swallows every comment between. Testing an
 * enumerated comment for containment in that span therefore answered
 * differently depending on what followed the tag: reported above an
 * undocumented declaration, silent above a documented one. The second is the
 * shape an author writes in a codebase that documents its exports, and it left
 * the run reporting only the coverage finding that tells them to write the
 * citation they had already written.
 *
 *  1. Write a citation in a line comment directly above a documentation block.
 *  2. Evaluate the same claim.
 *  3. Assert the tag is reported.
 *
 * @evidence contracts/testing.md#behavioral-verification runUnreadableRule reports exactly the unreadable citation at source line 4 even when a documentation block follows that line comment.
 * @evidence contracts/testing.md#independent-expectations A following JSDoc block cannot absorb an earlier // comment into a readable documentation span. The authored comment line and exact one-finding assertion define the expected result.
 * @evidence contracts/testing.md#distinguishing-cases A valid pricing citation on limit is followed by an unreadable line comment and a separate JSDoc block on other. This pins the documented-declaration boundary absent from the bare line-comment case.
 * @evidence contracts/testing.md#execution-ownership TestALineCommentAboveADocumentedDeclarationIsReported is the Go unit entry discovered beside the native package. runUnreadableRule parses the authored TypeScript fixture and checks its graph in that process; the helper owns the shared satisfied pricing section, while this entry owns its comment positions and assertions.
 */
func TestALineCommentAboveADocumentedDeclarationIsReported(t *testing.T) {
  assertReported(t, runUnreadableRule(t, `/** @evidence docs/spec.md#pricing The declaration cites this. */
export const limit = 1;

// @evidence docs/spec.md#pricing A tag nothing reads.
/** The other rate. */
export const other = 2;
`), "Unreadable @evidence at src/contracts.ts:4")
}
