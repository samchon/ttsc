package evidence

import (
  "testing"
)

/**
 * Verifies a citation on an inner declarator counts for that declarator's unit.
 *
 * `singleEvidencePerSymbol` counts distinct units per semantic host, and a
 * citation whose position belongs to no unit resolves to no host, so both
 * identities of the statement were reported as citing zero while the same run
 * reported the obligation satisfied. Recording the declarator is what gives the
 * tag a host to be counted against.
 *
 * The untagged sibling is the control: it must still be reported as citing
 * zero, or the case would pass equally if the policy had stopped counting hosts
 * at all.
 *
 *  1. Cite a section from the second declarator of a two-declarator statement.
 *  2. Evaluate a `singleEvidencePerSymbol` reference over it.
 *  3. Assert only the untagged sibling is reported.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with a property claim over src/** and a Markdown reference with `singleEvidencePerSymbol`, where `export const alpha = 1, /** @evidence docs/spec.md#pricing ... *\/ beta = 2;` cites on the second declarator only; assertReported requires exactly one diagnostic, containing `'alpha' at src/contracts.ts:2`.
 * @evidence contracts/testing.md#independent-expectations The expected single report is authored from the host contract: a citation on an inner declarator belongs to that declarator's own unit, so `beta` counts as citing one unit and only the untagged `alpha` is reported as citing none.
 * @evidence contracts/testing.md#distinguishing-cases The untagged sibling is the control: if the policy had stopped counting hosts, neither would be reported, and if the citation resolved to no host both would be, so the exactly-one result names `alpha` alone at its own line 2.
 * @evidence contracts/testing.md#execution-ownership TestInnerDeclaratorCitationCountsForItsOwnUnit is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestInnerDeclaratorCitationCountsForItsOwnUnit(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Pricing {#pricing}\n",
    "src/contracts.ts": `
export const alpha = 1,
  /** @evidence docs/spec.md#pricing The inner declarator cites this. */
  beta = 2;
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"property",
    "reference":{
      "type":"markdown","files":["docs/**/*.md"],"symbol":"h2",
      "singleEvidencePerSymbol":true
    }
  }]}`)
  assertReported(t, messages, "'alpha' at src/contracts.ts:2")
}
