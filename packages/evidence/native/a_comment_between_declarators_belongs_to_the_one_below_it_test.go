package evidence

import (
  "testing"
)

/**
 * Verifies where an ordinary comment between two declarators lands.
 *
 * Narrowing content to the declarator moved this line without anyone deciding
 * it, so the answer is pinned rather than left to be rediscovered. A `//`
 * comment is leading trivia of the declarator below it and is dropped by the
 * same rule that drops the blank lines above an undocumented declaration, while
 * a `/* *\/` comment survives that rule and is interior text of the declarator
 * it precedes. Neither reaches the declarator above, whose span ends at the
 * comma.
 *
 * A tag in either comment is reported as unreadable rather than read, so
 * neither is a position the digest has to exclude. What is at stake here is
 * only which edits expire a review.
 *
 *  1. Digest both declarators with a comment between them.
 *  2. Rewrite that comment as a line comment, then as a block comment.
 *  3. Assert the first moves neither and the second moves only the declarator
 *     below it.
 * @evidence contracts/testing.md#behavioral-verification variableDigestOf parses `export const alpha = 1, <note> beta = 2;` and returns the alpha and beta unit digests; the test compares them before and after the note text changes, as a line comment and as a block comment.
 * @evidence contracts/testing.md#independent-expectations The expected relation is stated by the review-expiry contract rather than computed: a `//` note is leading trivia and must change neither digest, while a `/* *\/` note is interior text of the declarator below it and must change that declarator's digest but not the one above.
 * @evidence contracts/testing.md#distinguishing-cases The line-comment pair requires both digests equal; the block-comment pair requires alpha equal and beta different. Each pair changes only the note text, so the adjacent-declarator and comment-kind decision is the only variable.
 * @evidence contracts/testing.md#execution-ownership TestACommentBetweenDeclaratorsBelongsToTheOneBelowIt is a Go unit entry in the native test process; variableDigestOf parses each source with the TypeScript parser and reads the inventory digest, with no consumer install or product host.
 */
func TestACommentBetweenDeclaratorsBelongsToTheOneBelowIt(t *testing.T) {
  between := func(note string) (string, string) {
    source := `export const alpha = 1,
  ` + note + `
  beta = 2;
`
    return variableDigestOf(t, "alpha", source), variableDigestOf(t, "beta", source)
  }
  lineBefore, lineBetaBefore := between("// A first note.")
  lineAfter, lineBetaAfter := between("// A second note, entirely different.")
  if lineBefore != lineAfter || lineBetaBefore != lineBetaAfter {
    t.Fatal("a line comment between declarators moved a digest, so a note expires a review")
  }
  blockBefore, blockBetaBefore := between("/* A first note. */")
  blockAfter, blockBetaAfter := between("/* A second note, entirely different. */")
  if blockBefore != blockAfter {
    t.Fatal("a block comment below a declarator moved that declarator's digest")
  }
  if blockBetaBefore == blockBetaAfter {
    t.Fatal("a block comment interior to a declarator left its digest unmoved, so content vanished from it")
  }
}
