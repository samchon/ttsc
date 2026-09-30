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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule is exercised with the scenario below; the assertions require the selected heading activates missing-acknowledgement coverage.
 * @evidence contracts/testing.md#independent-expectations The inactive cases prove file matching alone is insufficient. Adding one H2 host must restore the existing reference obligation without changing the claim configuration.
 * @evidence contracts/testing.md#distinguishing-cases Match one Markdown file containing the selected H2 host. Materialize one unacknowledged Markdown heading. Assert the selected heading activates missing-acknowledgement coverage.
 * @evidence contracts/testing.md#execution-ownership TestFirstSelectedMarkdownHeadingActivatesCoverage is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
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
