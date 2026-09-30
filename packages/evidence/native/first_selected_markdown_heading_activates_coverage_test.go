package evidence

import "testing"

/**
 * Verifies the first selected Markdown heading activates its claim.
 *
 * The inactive twins above prove file matching alone is insufficient. Adding
 * one H2 host must restore the existing reference obligation without changing
 * the claim configuration.
 *
 *  1. Match one Markdown file containing the selected H2 host.
 *  2. Materialize one unacknowledged Markdown heading.
 *  3. Assert the selected heading activates missing-acknowledgement coverage.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies the first selected Markdown heading activates its claim. The original assertions check assert the selected heading activates missing-acknowledgement coverage.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The inactive twins above prove file matching alone is insufficient. Adding one H2 host must restore the existing reference obligation without changing the claim configuration. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Match one Markdown file containing the selected H2 host. Materialize one unacknowledged Markdown heading. Assert the selected heading activates missing-acknowledgement coverage. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestFirstSelectedMarkdownHeadingActivatesCoverage is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
