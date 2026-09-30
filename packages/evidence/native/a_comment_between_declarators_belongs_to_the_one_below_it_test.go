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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification variableDigestOf exercises the authored fixture. Assert the first moves neither and the second moves only the declarator below it.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Narrowing content to the declarator moved this line without anyone deciding it, so the answer is pinned rather than left to be rediscovered. A `//` comment is leading trivia of the declarator below it and is dropped by the same rule that drops the blank lines above an undocumented declaration, while a `/* *\/` comment survives that rule and is interior text of the declarator it precedes. Neither reaches the declarator above, whose span ends at the comma. The authored scenario requires this outcome: Assert the first moves neither and the second moves only the declarator below it.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Digest both declarators with a comment between them. Rewrite that comment as a line comment, then as a block comment. Assert the first moves neither and the second moves only the declarator below it.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestACommentBetweenDeclaratorsBelongsToTheOneBelowIt runs as a Go unit entry in the native package. variableDigestOf executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
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
