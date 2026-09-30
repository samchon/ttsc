package evidence

import (
  "testing"
)

/**
 * Verifies a citation left behind in commented-out code is reported.
 *
 * A tag in a block an author commented out reaches nothing, exactly like the
 * others, and the first repair tried the opposite: it declined the whole
 * comment on the theory that naming a move would send the author to relocate a
 * tag they should delete. That silence cost more than it saved, because it
 * keyed on a line opening like a block after its slashes came off, so it also
 * swallowed every tag in any comment that happened to contain one such line.
 * The diagnostic names both moves instead.
 *
 *  1. Comment out a documented declaration whose block carries a citation.
 *  2. Evaluate the same claim.
 *  3. Assert the tag is reported.
 * @evidence contracts/testing.md#behavioral-verification runUnreadableRule reports exactly the citation stranded at source line 6 in a commented-out declaration.
 * @evidence contracts/testing.md#independent-expectations Retiring code removes its documentation host without erasing the remaining comment tokens. The authored retired tag line must still be diagnosed while the live pricing citation remains valid.
 * @evidence contracts/testing.md#distinguishing-cases A block-shaped declaration is entirely line-commented, including its tag. The exact assertion distinguishes reporting the stranded citation from silencing comments that contain block-like text.
 * @evidence contracts/testing.md#execution-ownership TestACitationInCommentedOutCodeIsReported is the Go unit entry discovered beside the native package. runUnreadableRule parses the authored TypeScript fixture and checks its graph in that process; the helper owns the shared satisfied pricing section, while this entry owns its comment positions and assertions.
 */
func TestACitationInCommentedOutCodeIsReported(t *testing.T) {
  assertReported(t, runUnreadableRule(t, `/** @evidence docs/spec.md#pricing The declaration cites this. */
export const limit = 1;

// /**
//  * Retired.
//  * @evidence docs/spec.md#pricing The old citation.
//  */
// export const old = 3;
`), "Unreadable @evidence at src/contracts.ts:6")
}
