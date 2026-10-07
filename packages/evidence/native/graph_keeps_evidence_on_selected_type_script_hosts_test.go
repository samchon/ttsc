package evidence

import "testing"

/**
 * Verifies ownership evidence remains bound to the symbol selector even when
 * the same public export is an eligible exclusion carrier.
 *
 * The carrier exception expresses non-applicability only. Letting `@evidence`
 * use it would move claimed implementation away from the declaration that
 * actually owns the behavior and erase the graph's host meaning.
 *
 *  1. Select a function host and cite the target from an exported property.
 *  2. Use `@evidence`, not `@evidenceExclude`, on that carrier.
 *  3. Assert the selected-host diagnostic and missing obligation both remain.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with a function claim over src/controllers/**\/*.ts, where a CONTROLLER_EVIDENCE_EXCLUDE.ts file carries `@evidence docs/spec.md#contract` on an exported data const beside `selectedController()`; the diagnostics must contain `Out-of-scope @evidence host`, `host kind 'property' is not selected` and `Missing acknowledgement for 'docs/spec.md#contract'`.
 * @evidence contracts/testing.md#independent-expectations The expectations are authored from the carrier contract: the carrier relaxation applies to `@evidenceExclude` only, so `@evidence` on the same public export remains bound to the selected host kind, is refused, and leaves the obligation owed.
 * @evidence contracts/testing.md#distinguishing-cases The positive tag on a carrier-eligible declaration, whose exclusion twin is accepted in the sibling public-carriers entry; only containment of the three fragments is asserted.
 * @evidence contracts/testing.md#execution-ownership TestGraphKeepsEvidenceOnSelectedTypeScriptHosts is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestGraphKeepsEvidenceOnSelectedTypeScriptHosts(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract\n",
    "src/controllers/CONTROLLER_EVIDENCE_EXCLUDE.ts": `
/**
 * Central controller exclusions.
 *
 * @evidence docs/spec.md#contract This property does not own an operation.
 */
export const CONTROLLER_EVIDENCE_EXCLUDE = true;
export function selectedController(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/controllers/**/*.ts"],
    "symbol":"function",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`)
  assertProblemContains(t, messages, "Out-of-scope @evidence host")
  assertProblemContains(t, messages, "host kind 'property' is not selected")
  assertProblemContains(t, messages, "Missing acknowledgement for 'docs/spec.md#contract'")
}
