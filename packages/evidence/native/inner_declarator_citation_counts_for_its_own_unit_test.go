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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises the authored fixture. Assert only the untagged sibling is reported.
 * @evidence contracts/testing.md#independent-expectations `singleEvidencePerSymbol` counts distinct units per semantic host, and a citation whose position belongs to no unit resolves to no host, so both identities of the statement were reported as citing zero while the same run reported the obligation satisfied. Recording the declarator is what gives the tag a host to be counted against. The authored scenario requires this outcome: Assert only the untagged sibling is reported.
 * @evidence contracts/testing.md#distinguishing-cases Cite a section from the second declarator of a two-declarator statement. Evaluate a `singleEvidencePerSymbol` reference over it. Assert only the untagged sibling is reported.
 * @evidence contracts/testing.md#execution-ownership TestInnerDeclaratorCitationCountsForItsOwnUnit runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
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
