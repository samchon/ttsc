package evidence

import "testing"

/**
 * Verifies the first selected exported host activates the complete claim.
 *
 * Inactivity is derived from the current Program rather than latched in
 * configuration. Adding one selected interface must therefore restore the
 * existing reference coverage behavior without another config edit.
 *
 *  1. Match one exported interface selected by a TypeScript `type` claim.
 *  2. Materialize one unacknowledged Markdown heading.
 *  3. Assert the now-active claim reports its missing acknowledgement.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies the first selected exported host activates the complete claim. The original assertions check assert the now-active claim reports its missing acknowledgement.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Inactivity is derived from the current Program rather than latched in configuration. Adding one selected interface must therefore restore the existing reference coverage behavior without another config edit. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Match one exported interface selected by a TypeScript `type` claim. Materialize one unacknowledged Markdown heading. Assert the now-active claim reports its missing acknowledgement. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestFirstSelectedTypeScriptExportActivatesCoverage is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestFirstSelectedTypeScriptExportActivatesCoverage(t *testing.T) {
  assertProblemContains(t, runIndexRule(t, map[string]string{
    "docs/spec.md":    "## Contract\n",
    "src/contract.ts": "export interface Contract {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"type",
    "reference":{
      "type":"markdown",
      "files":["docs/**/*.md"],
      "symbol":"h2"
    }
  }]}`), "Missing acknowledgement for 'docs/spec.md#contract'")
}
