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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with the shared entry claim (function claim over src/views/**, function reference over src/api/index.ts) with no src/api/index.ts present; assertProblemContains requires `matched no typescript files for ['src/api/index.ts']`.
 * @evidence contracts/testing.md#independent-expectations The expected message is authored from the population contract: a reference that resolves to no module must be reported against what it tried to select, because a silent empty population would read as a satisfied obligation.
 * @evidence contracts/testing.md#distinguishing-cases A reference glob matching no file; the package-glob outside the entry surface and the matched-but-no-selected-kind cases are owned by sibling entries.
 * @evidence contracts/testing.md#execution-ownership TestGraphReportsAMissingReferenceModule is a Go unit entry in the native test process; runIndexRule writes the fixture to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestGraphReportsAMissingReferenceModule(t *testing.T) {
  assertProblemContains(t, runIndexRule(t, map[string]string{
    "src/views/detail.ts": "export function detail(): void {}\n",
  }, entryClaimConfig), "matched no typescript files for ['src/api/index.ts']")
}
