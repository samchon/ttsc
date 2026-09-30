package evidence

import (
  "path/filepath"
  "testing"
)

/**
 * Verifies an absolute declared root does not move the location a reader
 * opens.
 *
 * Only the name of the configuration property moved. A file's location is
 * derived from `Display`, which this change deliberately leaves alone, so the
 * repair must be invisible to a reader who is opening files rather than editing
 * configuration; and the two spellings now legitimately differ in one message.
 *
 *  1. Root a Markdown reference at an absolute directory holding one document.
 *  2. Leave its selected section uncited.
 *  3. Assert the location ascends project-relatively and the target does not.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runRootedGraphIn is exercised with the scenario below; the assertions require the location ascends project-relatively and the target does not.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Only the name of the configuration property moved. A file's location is derived from `Display`, which this change deliberately leaves alone, so the repair must be invisible to a reader who is opening files rather than editing configuration; and the two spellings now legitimately differ in one message.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Root a Markdown reference at an absolute directory holding one document. Leave its selected section uncited. Assert the location ascends project-relatively and the target does not.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestAnAbsoluteRootLeavesFileLocationsProjectRelative is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
 */
func TestAnAbsoluteRootLeavesFileLocationsProjectRelative(t *testing.T) {
  workspace := t.TempDir()
  docs := filepath.ToSlash(filepath.Join(workspace, "docs"))
  messages := runRootedGraphIn(t, workspace, map[string]string{
    "docs/requirements/pricing.md": "## Discounts {#discounts}\n",
    "project/src/sale.ts":          "export interface ISale {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{
      "type":"markdown",
      "root":"`+docs+`",
      "files":["requirements/**"],
      "symbol":"h2"
    }
  }]}`)
  assertProblemContains(
    t,
    messages,
    "Missing acknowledgement for 'requirements/pricing.md#discounts'",
  )
  assertProblemContains(t, messages, "at ../docs/requirements/pricing.md:1")
}
