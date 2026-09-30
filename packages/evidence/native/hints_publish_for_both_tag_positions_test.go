package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies both tag positions receive the corpus.
 *
 * An exclusion names a target under the same grammar as a citation, so an
 * author writing one needs the same list. A corpus published for `@evidence`
 * alone would help the easy half and abandon the half that has to justify
 * itself in review.
 *
 *  1. Publish a corpus for a satisfied document.
 *  2. Narrow it to each trigger.
 *  3. Assert both carry the same targets.
 * @evidence contracts/testing.md#behavioral-verification runGraphHints publishes a nonempty citation target list and an identical list at the exclusion trigger for an ordinary Markdown reference.
 * @evidence contracts/testing.md#independent-expectations Ordinary references allow both positive citations and exclusions to use the same target grammar. The two independently narrowed lists must agree; this equality does not determine their exact target spelling.
 * @evidence contracts/testing.md#distinguishing-cases Citation and exclusion triggers are compared for the same satisfied graph. Strict exclusion references are exercised by TestHintsOmitTargetsBelongingOnlyToForbiddenExclusionReferences.
 * @evidence contracts/testing.md#execution-ownership TestHintsPublishForBothTagPositions is the Go unit entry discovered beside the native package. Its runGraphHints fixture executes Check and the simulated passing gate before Hints in the same process; it does not launch an editor, LSP host or native artifact.
 */
func TestHintsPublishForBothTagPositions(t *testing.T) {
  hints, messages := runGraphHints(t, map[string]string{
    "docs/pricing.md": "## Sale Price {#sale-price}\n",
    "src/sale.ts":     hintsSatisfiedSource,
  }, hintsMarkdownConfig)
  assertSilent(t, messages)
  cited := targetInserts(targetHintsAt(hints, "@evidence "))
  excluded := targetInserts(targetHintsAt(hints, "@evidenceExclude "))
  if len(cited) == 0 {
    t.Fatal("expected a corpus at the citation trigger")
  }
  if strings.Join(cited, "\n") != strings.Join(excluded, "\n") {
    t.Fatalf(
      "both triggers must carry the same targets:\n%s\n---\n%s",
      strings.Join(cited, "\n"),
      strings.Join(excluded, "\n"),
    )
  }
}
