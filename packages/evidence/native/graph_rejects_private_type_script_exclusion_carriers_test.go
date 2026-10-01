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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with a function claim over src/controllers/**\/*.ts, where an unexported `const CONTROLLER_EVIDENCE_EXCLUDE` carries `@evidenceExclude docs/spec.md#contract` beside an exported `selectedController()`; the diagnostics must contain `Out-of-scope @evidenceExclude carrier`, `unsupported or non-exported declaration` and `Missing acknowledgement for 'docs/spec.md#contract'`.
 * @evidence contracts/testing.md#independent-expectations The expectations are authored from the carrier contract: eligibility follows the public declaration inventory, so a private constant must not become an acknowledgement surface and the section it meant to exclude stays owed.
 * @evidence contracts/testing.md#distinguishing-cases The unexported twin of the exported carrier accepted in the sibling public-carriers entry: only the export keyword differs, and containment of the three fragments is asserted.
 * @evidence contracts/testing.md#execution-ownership TestGraphRejectsPrivateTypeScriptExclusionCarriers is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
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
