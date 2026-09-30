package evidence

import (
  "path/filepath"
  "testing"
)

/**
 * Verifies a glob diagnostic under an absolute root names that root as written.
 *
 * `describePopulation` reaches every claim and reference glob message that has a
 * declared root, and it is the one an author reads most often, because it fires
 * whenever the root is fine and the patterns are not. A root spelled one way in
 * the message and another in the configuration turns a pattern question into a
 * hunt for a directory that is not missing.
 *
 *  1. Root a Markdown reference at an absolute directory that exists.
 *  2. Select with patterns no document under it matches.
 *  3. Assert the empty-match diagnostic names the declared spelling.
 * @evidence contracts/testing.md#behavioral-verification runRootedGraphIn is exercised with the scenario below; the assertions require the empty-match diagnostic names the declared spelling.
 * @evidence contracts/testing.md#independent-expectations `describePopulation` reaches every claim and reference glob message that has a declared root, and it is the one an author reads most often, because it fires whenever the root is fine and the patterns are not. A root spelled one way in the message and another in the configuration turns a pattern question into a hunt for a directory that is not missing.
 * @evidence contracts/testing.md#distinguishing-cases Root a Markdown reference at an absolute directory that exists. Select with patterns no document under it matches. Assert the empty-match diagnostic names the declared spelling.
 * @evidence contracts/testing.md#execution-ownership TestAGlobDiagnosticNamesAnAbsoluteRootAsWritten is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
 */
func TestAGlobDiagnosticNamesAnAbsoluteRootAsWritten(t *testing.T) {
  workspace := t.TempDir()
  contracts := filepath.ToSlash(filepath.Join(workspace, "contracts"))
  messages := runRootedGraphIn(t, workspace, map[string]string{
    "contracts/requirements/pricing.md": "## Discounts {#discounts}\n",
    "project/src/sale.ts":               "export interface ISale {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{
      "type":"markdown",
      "root":"`+contracts+`",
      "files":["specs/**"],
      "symbol":"h2"
    }
  }]}`)
  assertProblemContains(
    t,
    messages,
    "matched no markdown files for ['specs/**'] under root '"+contracts+"'",
  )
}
