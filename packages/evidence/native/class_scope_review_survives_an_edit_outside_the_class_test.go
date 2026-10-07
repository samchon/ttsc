package evidence

import "testing"

/**
 * Verifies the same review survives an edit outside the class.
 *
 * The negative twin. A digest taken over the file rather than over the
 * declaration would expire on any edit at all, and the complementary regression would pass
 * either way, so the boundary of the scope is what needs pinning rather than
 * the fact that something expires it. The sibling added here is a whole
 * declaration rather than whitespace, because whitespace alone is normalized
 * out and would prove nothing about the boundary.
 *
 *  1. Review the same class with the value the graph asks for.
 *  2. Add an unrelated declaration below it in the same file.
 *  3. Assert the graph is still clean.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule reviews unchanged Sale then appends IUnrelated to its file; the accepted token must still produce no diagnostics.
 * @evidence contracts/testing.md#independent-expectations A declaration scope excludes unrelated siblings in the same file; its seed comes from the graph and is not a literal hash oracle.
 * @evidence contracts/testing.md#distinguishing-cases A real added declaration detects file-wide digest contamination that whitespace normalization alone would miss.
 * @evidence contracts/testing.md#execution-ownership TestClassScopeReviewSurvivesAnEditOutsideTheClass is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
 */
func TestClassScopeReviewSurvivesAnEditOutsideTheClass(t *testing.T) {
  expected := reviewedFingerprintAt(
    t,
    classReviewProject(classReviewSource, ""),
    classReviewConfig,
  )
  review := " * @evidenceReview {@link Sale} #" + expected +
    " Read every field of the subject against the schema.\n"
  // The class is the baseline verbatim, so the only difference is the sibling
  // below it. Retyping it would move the class's own text and the case would
  // stop being about the boundary.
  assertNoProblems(t, runIndexRule(t, classReviewProject(
    classReviewSource+"\nexport interface IUnrelated {}\n",
    review,
  ), classReviewConfig))
}
