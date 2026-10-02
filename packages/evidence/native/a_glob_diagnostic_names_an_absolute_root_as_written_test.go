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
 *
 * @evidence contracts/testing.md#behavioral-verification runRootedGraphIn runs the graph rule with a Markdown reference rooted at the absolute temp contracts directory, which holds requirements/pricing.md, selecting files ["specs/**"]; assertProblemContains requires the message `matched no markdown files for ['specs/**'] under root '<that directory>'`.
 * @evidence contracts/testing.md#independent-expectations The expected root text is the slash-normalized path the test itself allocated and wrote into the configuration, so the oracle is the author's own spelling rather than a value recomputed by the resolver.
 * @evidence contracts/testing.md#distinguishing-cases The root exists and contains a document, and only the pattern is wrong, so the diagnostic must be the empty-match one naming the root as written rather than a missing-root one. A relative-root spelling is not exercised here.
 * @evidence contracts/testing.md#execution-ownership TestAGlobDiagnosticNamesAnAbsoluteRootAsWritten is a Go unit entry in the native test process; runRootedGraphIn writes the workspace to a temp directory and calls the graph rule directly, with no consumer install or product host.
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
