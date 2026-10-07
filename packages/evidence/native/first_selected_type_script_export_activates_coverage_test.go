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
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with a TypeScript `type` claim over src/** containing `export interface Contract {}` and a Markdown reference with one uncited `## Contract` heading; assertProblemContains requires `Missing acknowledgement for 'docs/spec.md#contract'`.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the activation contract: inactivity is derived from the current Program, so one selected interface activates the claim and the existing reference obligation is reported without any further configuration.
 * @evidence contracts/testing.md#distinguishing-cases One selected exported interface making an otherwise inactive claim active; the inactive cases (no selected host) are owned by sibling entries.
 * @evidence contracts/testing.md#execution-ownership TestFirstSelectedTypeScriptExportActivatesCoverage is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
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
