package evidence

import (
  "testing"
)

/**
 * Verifies claim-local disabling does not suppress a source selected by an
 * enabled overlapping claim.
 *
 * `disabled` removes an obligation, not a physical file. Filtering shared
 * inventories by path would make the enabled claim vanish merely because a
 * disabled claim selected the same source.
 *
 *  1. Select one source from disabled and enabled claims.
 *  2. Satisfy only the enabled claim's live reference.
 *  3. Assert the enabled overlapping obligation is evaluated and passes.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule must return no diagnostic when disabled and enabled claims select the same IShared source and its docs/live.md#live citation satisfies the live reference. Silence rejects an erroneous disabled-root failure; by itself it cannot distinguish valid activation from incorrectly dropping the enabled claim.
 * @evidence contracts/testing.md#independent-expectations `disabled` removes an obligation, not a physical file. Filtering shared inventories by path would make the enabled claim vanish merely because a disabled claim selected the same source.
 * @evidence contracts/testing.md#distinguishing-cases The staged claim selects the same physical source but points to a missing reference root; the enabled claim selects an existing live section and cites it. This positive overlap case expects silence. TestDisabledClaimCannotCoverAnEnabledSibling supplies the negative enabled-coverage case.
 * @evidence contracts/testing.md#execution-ownership TestDisabledClaimDoesNotSuppressAnEnabledOverlappingSource is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
 */
func TestDisabledClaimDoesNotSuppressAnEnabledOverlappingSource(t *testing.T) {
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "docs/live.md": "## Live Requirement {#live}\n",
    "src/shared.ts": `/** @evidence docs/live.md#live Live implementation. */
export interface IShared {}
`,
  }, `{"claims":[
    {
      "type":"typescript",
      "disabled":true,
      "files":["src/shared.ts"],
      "symbol":"type",
      "reference":{"type":"markdown","root":"missing-reference-root","files":["**/*.md"],"symbol":"h2"}
    },
    {
      "type":"typescript",
      "files":["src/shared.ts"],
      "symbol":"type",
      "reference":{"type":"markdown","files":["docs/live.md"],"symbol":"h2"}
    }
  ]}`))
}
