package evidence

import "testing"

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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies claim-local disabling does not suppress a source selected by an enabled overlapping claim. The original assertions check assert the enabled overlapping obligation is evaluated and passes.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations `disabled` removes an obligation, not a physical file. Filtering shared inventories by path would make the enabled claim vanish merely because a disabled claim selected the same source. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Select one source from disabled and enabled claims. Satisfy only the enabled claim's live reference. Assert the enabled overlapping obligation is evaluated and passes. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestDisabledClaimDoesNotSuppressAnEnabledOverlappingSource is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
