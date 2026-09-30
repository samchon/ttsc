package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies the corpus carries a selected heading under its exact target.
 *
 * The anchor is what an author cannot reproduce from memory, which is the whole
 * reason to publish a corpus. One listing headings by title rather than by
 * target would look right in an editor and insert something the graph cannot
 * resolve.
 *
 *  1. Satisfy a graph over one document with a selected heading.
 *  2. Take the published corpus.
 *  3. Assert the heading's target is offered with its text alongside.
 * @evidence contracts/testing.md#behavioral-verification runGraphHints must return a silent passing graph whose citation hints contain docs/pricing.md#sale-price and whose matching detail contains Sale Price.
 * @evidence contracts/testing.md#independent-expectations The explicit {#sale-price} fixture anchor and authored heading text independently specify the inserted target and detail; a title-only insert or lost heading label fails.
 * @evidence contracts/testing.md#distinguishing-cases One selected H2 under a file-wide acknowledgement exercises both target identity and readable detail. TestHintsOmitUnselectedHeadings owns an adjacent unselected H3.
 * @evidence contracts/testing.md#execution-ownership TestHintsPublishSelectedHeadings is the Go unit entry discovered beside the native package. Its runGraphHints fixture executes Check and the simulated passing gate before Hints in the same process; it does not launch an editor, LSP host or native artifact.
 */
func TestHintsPublishSelectedHeadings(t *testing.T) {
  hints, messages := runGraphHints(t, map[string]string{
    "docs/pricing.md": "## Sale Price {#sale-price}\n",
    "src/sale.ts":     hintsSatisfiedSource,
  }, hintsMarkdownConfig)
  assertSilent(t, messages)
  cited := targetHintsAt(hints, "@evidence ")
  if !contains(targetInserts(cited), "docs/pricing.md#sale-price") {
    t.Fatalf(
      "expected the heading target, got:\n%s",
      strings.Join(targetInserts(cited), "\n"),
    )
  }
  for _, hint := range cited {
    if hint.Insert != "docs/pricing.md#sale-price" {
      continue
    }
    if !strings.Contains(hint.Detail, "Sale Price") {
      t.Fatalf("expected the heading text as detail, got %q", hint.Detail)
    }
  }
}
