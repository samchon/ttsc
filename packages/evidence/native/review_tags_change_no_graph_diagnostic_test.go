package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a review tag changes no `evidence/graph` diagnostic, under every
 * reference policy that counts.
 *
 * This is the load-bearing regression of the whole feature, and the failure it
 * guards is silent in both directions. `evaluateEvidenceGraph` files every
 * parsed declaration into `acknowledged`, `evidenceByUnit`, `exclusionByUnit`,
 * `evidenceByHostAndScope`, `evidenceUnitsByHost`, and `evidenceHostsByUnit`. A
 * review reaching any of them discharges coverage, counts as a semantic host
 * under `uniqueEvidence`, or counts as a cited unit under
 * `singleEvidencePerSymbol` — a build going green because a review was mistaken
 * for evidence. A review the graph cannot see at all would instead surface as a
 * "Non-participating" finding, since it resolves and discharges nothing.
 *
 * The two are compared rather than asserted against fixed text, because the
 * property is equality with the graph that has no reviews in it, and any literal
 * expectation here would drift from the graph's real messages.
 *
 *  1. Build one project whose claim under-covers a two-heading document and
 *     whose reference sets `uniqueEvidence` and `singleEvidencePerSymbol`.
 *  2. Run the graph on it, then run it again with review tags added to the same
 *     blocks and nothing else changed.
 *  3. Assert both runs produce identical diagnostics, and that the run is not
 *     vacuously clean.
 */
func TestReviewTagsChangeNoGraphDiagnostic(t *testing.T) {
  document := "## Pricing\n\n## Refunds\n"
  plain := `/**
 * @evidence docs/spec.md#pricing Derives the sale price from this section.
 */
export interface ISale {
  price: number;
}
`
  reviewed := `/**
 * @evidence docs/spec.md#pricing Derives the sale price from this section.
 * @evidenceReview docs/spec.md#pricing #a3f9c1d Section caps the rate at 30%; price clamps to 30.
 * @evidenceReview docs/spec.md#refunds Checked; this type does not own refunds.
 */
export interface ISale {
  price: number;
}
`
  config := `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"type",
    "reference":{
      "type":"markdown",
      "files":["docs/**/*.md"],
      "symbol":"h2",
      "uniqueEvidence":true,
      "singleEvidencePerSymbol":true
    }
  }]}`
  before := runIndexRule(t, map[string]string{
    "docs/spec.md": document,
    "src/ISale.ts": plain,
  }, config)
  after := runIndexRule(t, map[string]string{
    "docs/spec.md": document,
    "src/ISale.ts": reviewed,
  }, config)
  if len(before) == 0 {
    t.Fatal("expected the baseline graph to report an under-covered document, got nothing")
  }
  if strings.Join(before, "\n") != strings.Join(after, "\n") {
    t.Fatalf(
      "review tags changed the graph's diagnostics.\nwithout reviews:\n%s\nwith reviews:\n%s",
      strings.Join(before, "\n"),
      strings.Join(after, "\n"),
    )
  }
  if count := countProblemsContaining(after, "Non-participating"); count != 0 {
    t.Fatalf("a review tag surfaced as a non-participating declaration %d time(s)", count)
  }
}
