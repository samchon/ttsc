package evidence

import (
  "testing"
)

/**
 * Verifies a tag behind any run of slashes is reported.
 *
 * Prisma answers a tag buried behind a fourth slash, and the reasons carry
 * over: the comment is real, the file keeps it, and the tag is unreadable by
 * one keystroke. Answering only two slashes also split one comment against
 * itself, because the review parser strips `///` and the declaration parser
 * does not, so `/// @evidenceReview` was reported while the `/// @evidence`
 * beside it was not.
 *
 *  1. Write a citation behind three slashes and another behind four.
 *  2. Evaluate the same claim.
 *  3. Assert both are reported.
 *
 * @evidence contracts/testing.md#behavioral-verification runUnreadableRule must report unreadable citations at source lines 4 and 7 for triple- and quadruple-slash comments.
 * @evidence contracts/testing.md#independent-expectations Extra slashes do not turn a real line comment into supported JSDoc or remove its tag. The two independently authored line locations require both findings.
 * @evidence contracts/testing.md#distinguishing-cases Three and four opening slashes exercise normalization of adjacent comment forms beside one valid citation. Each subset assertion preserves the corresponding failure identity but does not exclude extra diagnostics.
 * @evidence contracts/testing.md#execution-ownership TestATagBehindAnyRunOfSlashesIsReported is the Go unit entry discovered beside the native package. runUnreadableRule parses the authored TypeScript fixture and checks its graph in that process; the helper owns the shared satisfied pricing section, while this entry owns its comment positions and assertions.
 */
func TestATagBehindAnyRunOfSlashesIsReported(t *testing.T) {
  messages := runUnreadableRule(t, `/** @evidence docs/spec.md#pricing The declaration cites this. */
export const limit = 1;

/// @evidence docs/spec.md#pricing Three slashes read nothing.
export const other = 2;

//// @evidence docs/spec.md#pricing Four slashes read nothing either.
export const third = 3;
`)
  assertReportedAmong(t, messages, "Unreadable @evidence at src/contracts.ts:4")
  assertReportedAmong(t, messages, "Unreadable @evidence at src/contracts.ts:7")
}
