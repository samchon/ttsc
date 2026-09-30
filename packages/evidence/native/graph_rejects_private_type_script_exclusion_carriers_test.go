package evidence

import "testing"

/**
 * Verifies an unexported declaration is not promoted into an exclusion carrier.
 *
 * Carrier eligibility follows the same public-declaration inventory the graph
 * can identify durably. Accepting a private constant would create an invisible
 * acknowledgement surface that generated declarations and consumers cannot
 * address.
 *
 *  1. Put an exclusion on an unexported constant beside a selected function.
 *  2. Materialize one Markdown obligation for that active function claim.
 *  3. Assert the carrier is rejected and the obligation remains missing.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies an unexported declaration is not promoted into an exclusion carrier. The original assertions check assert the carrier is rejected and the obligation remains missing.
 * @evidence contracts/testing.md#independent-expectations Carrier eligibility follows the same public-declaration inventory the graph can identify durably. Accepting a private constant would create an invisible acknowledgement surface that generated declarations and consumers cannot address. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Put an exclusion on an unexported constant beside a selected function. Materialize one Markdown obligation for that active function claim. Assert the carrier is rejected and the obligation remains missing. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestGraphRejectsPrivateTypeScriptExclusionCarriers is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestGraphRejectsPrivateTypeScriptExclusionCarriers(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract\n",
    "src/controllers/CONTROLLER_EVIDENCE_EXCLUDE.ts": `
/** @evidenceExclude docs/spec.md#contract This private ledger must not count. */
const CONTROLLER_EVIDENCE_EXCLUDE = true;
export function selectedController(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/controllers/**/*.ts"],
    "symbol":"function",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`)
  assertProblemContains(t, messages, "Out-of-scope @evidenceExclude carrier")
  assertProblemContains(t, messages, "unsupported or non-exported declaration")
  assertProblemContains(t, messages, "Missing acknowledgement for 'docs/spec.md#contract'")
}
