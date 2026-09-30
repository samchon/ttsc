package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies headings are offered before file targets.
 *
 * Slice order is the corpus's only ranking channel, and it answers what an
 * author cannot supply from memory. A file path is visible in the project tree;
 * a generated anchor is neither visible nor guessable, so it comes first.
 *
 *  1. Select both the file and its headings.
 *  2. Take the published corpus.
 *  3. Assert the heading precedes the file target.
 * @evidence contracts/testing.md#behavioral-verification runGraphHints and targetHintsAt expose citation insertion order; both the heading and document must exist and the heading index must precede the file index.
 * @evidence contracts/testing.md#independent-expectations The completion contract ranks hard-to-reproduce anchors before visible file paths. Literal fixture targets identify the two entries independently of their computed indexes.
 * @evidence contracts/testing.md#distinguishing-cases A selected file with one selected heading distinguishes reversed ranking from correct order; requiring both entries rejects a corpus that silently drops either.
 * @evidence contracts/testing.md#execution-ownership TestHintsRankHeadingsBeforeFiles is the Go unit entry discovered beside the native package. Its runGraphHints fixture executes Check and the simulated passing gate before Hints in the same process; it does not launch an editor, LSP host or native artifact.
 */
func TestHintsRankHeadingsBeforeFiles(t *testing.T) {
  hints, messages := runGraphHints(t, map[string]string{
    "docs/pricing.md": "## Sale Price {#sale-price}\n",
    "src/sale.ts":     hintsSatisfiedSource,
  }, hintsMarkdownConfig)
  assertSilent(t, messages)
  inserts := targetInserts(targetHintsAt(hints, "@evidence "))
  heading := indexOf(inserts, "docs/pricing.md#sale-price")
  file := indexOf(inserts, "docs/pricing.md")
  if heading < 0 || file < 0 {
    t.Fatalf("expected both targets, got:\n%s", strings.Join(inserts, "\n"))
  }
  if heading > file {
    t.Fatalf(
      "headings must be offered before file targets, got:\n%s",
      strings.Join(inserts, "\n"),
    )
  }
}
