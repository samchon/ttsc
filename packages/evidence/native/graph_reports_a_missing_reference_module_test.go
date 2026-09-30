package evidence

import "testing"

/**
 * Verifies a glob matching nothing is reported against what it tried to select.
 *
 * A population that resolves to no module materializes no units, and a silent
 * empty population would read as a satisfied obligation — the failure this
 * product exists to prevent.
 *
 *  1. Point a reference at a module that does not exist.
 *  2. Evaluate the graph.
 *  3. Assert the diagnostic names the attempted population.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies a glob matching nothing is reported against what it tried to select. The original assertions check assert the diagnostic names the attempted population.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations A population that resolves to no module materializes no units, and a silent empty population would read as a satisfied obligation — the failure this product exists to prevent. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Point a reference at a module that does not exist. Evaluate the graph. Assert the diagnostic names the attempted population. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestGraphReportsAMissingReferenceModule is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestGraphReportsAMissingReferenceModule(t *testing.T) {
  assertProblemContains(t, runIndexRule(t, map[string]string{
    "src/views/detail.ts": "export function detail(): void {}\n",
  }, entryClaimConfig), "matched no typescript files for ['src/api/index.ts']")
}
