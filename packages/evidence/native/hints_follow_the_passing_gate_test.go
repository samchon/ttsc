package evidence

import (
  "strings"
  "testing"
)

// hintsTypeScriptConfig cites a TypeScript population from TypeScript, which
// is the only claim kind that can address one.
const hintsTypeScriptConfig = `{"claims":[{
  "type":"typescript",
  "files":["src/ledger.ts"],
  "symbol":"type",
  "reference":{"type":"typescript","files":["src/sale.ts"],"symbol":"type"}
}]}`

// hintsSatisfiedLedger acknowledges the exported type, so the graph passes.
const hintsSatisfiedLedger = `import type { ISale } from "./sale";

/** @evidence {@link ISale} Documents the sale contract. */
export interface ILedger {}
`

/**
 * Verifies the modeled passing gate publishes a satisfied graph and withholds a reporting one.
 *
 * runGraphHints invokes Check and simulates the host snapshot admission rule before invoking Hints. This pins the modeled contract without starting an LSP host; a production host change requires separate host coverage.
 *
 * 1. Satisfy one Markdown graph and require a nonempty corpus.
 * 2. Remove its citation and require a report.
 * 3. Require the modeled gate to withhold the failing graph corpus.
 * @evidence contracts/testing.md#behavioral-verification runGraphHints produces a nonempty corpus for a satisfied graph, then reports an uncited graph and suppresses its corpus through the helper gate.
 * @evidence contracts/testing.md#independent-expectations The modeled host gate permits hints only after Check reports no failure and supplies state. Presence of a report and absence of hints specify the failing half; the test does not invoke the production LSP gate.
 * @evidence contracts/testing.md#distinguishing-cases Two otherwise equivalent document graphs differ only by the source acknowledgement. The passing half rejects unconditional withholding, and the reporting half rejects unconditional publication.
 * @evidence contracts/testing.md#execution-ownership TestHintsFollowThePassingGate is the Go unit entry discovered beside the native package. Its runGraphHints fixture executes Check and the simulated passing gate before Hints in the same process; it does not launch an editor, LSP host or native artifact.
 */
func TestHintsFollowThePassingGate(t *testing.T) {
  satisfied, messages := runGraphHints(t, map[string]string{
    "docs/pricing.md": "## Sale Price {#sale-price}\n",
    "src/sale.ts":     hintsSatisfiedSource,
  }, hintsMarkdownConfig)
  assertSilent(t, messages)
  if len(satisfied) == 0 {
    t.Fatal("a passing graph must publish a corpus")
  }

  withdrawn, failures := runGraphHints(t, map[string]string{
    "docs/pricing.md": "## Sale Price {#sale-price}\n",
    "src/sale.ts":     "export interface ISale {\n  price: number;\n}\n",
  }, hintsMarkdownConfig)
  if len(failures) == 0 {
    t.Fatal("expected the unacknowledged document to be reported")
  }
  if len(withdrawn) != 0 {
    t.Fatalf(
      "a reporting graph publishes no corpus; got %d hints:\n%s",
      len(withdrawn),
      strings.Join(targetInserts(withdrawn), "\n"),
    )
  }
}
