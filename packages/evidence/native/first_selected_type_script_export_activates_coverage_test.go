package evidence

import (
  "testing"
)

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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule is exercised with the scenario below; the assertions require the now-active claim reports its missing acknowledgement.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Inactivity is derived from the current Program rather than latched in configuration. Adding one selected interface must therefore restore the existing reference coverage behavior without another config edit.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Match one exported interface selected by a TypeScript `type` claim. Materialize one unacknowledged Markdown heading. Assert the now-active claim reports its missing acknowledgement.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestFirstSelectedTypeScriptExportActivatesCoverage is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
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
