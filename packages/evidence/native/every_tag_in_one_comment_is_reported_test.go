package evidence

import (
  "testing"
)

/**
 * Verifies every tag in one comment is reported, not only the first.
 *
 * A comment is read line by line and each tag in it is its own declaration, so
 * one unreadable line must not decide for the others. The first repair took the
 * whole comment out on the strength of a single line, which silenced tags
 * above and below it in the same block: a regression the shape below is the
 * smallest witness of.
 *
 *  1. Write two citations in one block comment with a slash-prefixed line
 *     between them.
 *  2. Evaluate the same claim.
 *  3. Assert both are reported at their own lines.
 *
 * @evidence contracts/testing.md#behavioral-verification runUnreadableRule must report both unreadable citations at source lines 5 and 7 inside one ordinary block comment.
 * @evidence contracts/testing.md#independent-expectations Each tag line is its own declaration, so a slash-prefixed intervening note cannot suppress either. The authored fifth and seventh lines independently specify both locations.
 * @evidence contracts/testing.md#distinguishing-cases Two citations surround a //-prefixed note in a non-JSDoc block. Separate subset assertions catch losing either tag and allow unrelated findings.
 * @evidence contracts/testing.md#execution-ownership TestEveryTagInOneCommentIsReported is the Go unit entry discovered beside the native package. runUnreadableRule parses the authored TypeScript fixture and checks its graph in that process; the helper owns the shared satisfied pricing section, while this entry owns its comment positions and assertions.
 */
func TestEveryTagInOneCommentIsReported(t *testing.T) {
  messages := runUnreadableRule(t, `/** @evidence docs/spec.md#pricing The declaration cites this. */
export const limit = 1;

/*
@evidence docs/spec.md#pricing The first tag in the block.
// * a note somebody pasted in
@evidence docs/spec.md#pricing The second tag in the block.
*/
export const other = 2;
`)
  assertReportedAmong(t, messages, "Unreadable @evidence at src/contracts.ts:5")
  assertReportedAmong(t, messages, "Unreadable @evidence at src/contracts.ts:7")
}
