package evidence

import (
  "testing"
)

/**
 * Verifies the first selected Markdown heading activates its claim.
 *
 * The inactive cases prove file matching alone is insufficient. Adding
 * one H2 host must restore the existing reference obligation without changing
 * the claim configuration.
 *
 *  1. Match one Markdown file containing the selected H2 host.
 *  2. Materialize one unacknowledged Markdown heading.
 *  3. Assert the selected heading activates missing-acknowledgement coverage.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with a Markdown claim over docs/claim.md (one `## Contract` heading) and a Markdown reference over docs/reference.md (one `## Requirement` heading); assertProblemContains requires `Missing acknowledgement`.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the activation contract: a claim is active once its own population holds a selected host, so one H2 in the claim file makes the reference obligation owed and unmet.
 * @evidence contracts/testing.md#distinguishing-cases The active counterpart of the inactive cases owned by sibling activation entries: file matching alone is insufficient, and here a selected H2 host is present. Only the presence of the diagnostic is asserted, not its target text.
 * @evidence contracts/testing.md#execution-ownership TestFirstSelectedMarkdownHeadingActivatesCoverage is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestFirstSelectedMarkdownHeadingActivatesCoverage(t *testing.T) {
  assertProblemContains(t, runIndexRule(t, map[string]string{
    "docs/claim.md":     "## Contract\n",
    "docs/reference.md": "## Requirement\n",
  }, `{"claims":[{
    "type":"markdown",
    "files":["docs/claim.md"],
    "symbol":"h2",
    "reference":{
      "type":"markdown",
      "files":["docs/reference.md"],
      "symbol":"h2"
    }
  }]}`), "Missing acknowledgement")
}
