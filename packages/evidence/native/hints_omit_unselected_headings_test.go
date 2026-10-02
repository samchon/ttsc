package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a heading the reference does not select stays out of the corpus.
 *
 * The corpus is a projection of the configured population, so an unselected
 * heading is not a target. Offering one would teach that any completion is
 * citable, and the author's next build would disagree.
 *
 *  1. Select `h2` only, and declare an `h3` beneath the `h2`.
 *  2. Take the published corpus.
 *  3. Assert the `h3` target is absent while the `h2` is present.
 *
 * @evidence contracts/testing.md#behavioral-verification runGraphHints returns the selected sale-price target and must omit rounding from every returned hint insert.
 * @evidence contracts/testing.md#independent-expectations The reference selects file and h2, so the authored H2 is available while the nested H3 is outside the completion population, regardless of containment coverage.
 * @evidence contracts/testing.md#distinguishing-cases The same document contains H2 sale-price and H3 rounding; presence of the H2 prevents empty completion output from satisfying the H3 absence check.
 * @evidence contracts/testing.md#execution-ownership TestHintsOmitUnselectedHeadings is the Go unit entry discovered beside the native package. Its runGraphHints fixture executes Check and the simulated passing gate before Hints in the same process; it does not launch an editor, LSP host or native artifact.
 */
func TestHintsOmitUnselectedHeadings(t *testing.T) {
  hints, messages := runGraphHints(t, map[string]string{
    "docs/pricing.md": "## Sale Price {#sale-price}\n\n### Rounding {#rounding}\n",
    "src/sale.ts":     hintsSatisfiedSource,
  }, hintsMarkdownConfig)
  assertSilent(t, messages)
  inserts := targetInserts(hints)
  if contains(inserts, "docs/pricing.md#rounding") {
    t.Fatalf("an unselected heading must not be offered:\n%s", strings.Join(inserts, "\n"))
  }
  if !contains(inserts, "docs/pricing.md#sale-price") {
    t.Fatalf("the selected heading must be offered:\n%s", strings.Join(inserts, "\n"))
  }
}
