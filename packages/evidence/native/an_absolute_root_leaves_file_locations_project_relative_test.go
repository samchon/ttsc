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
 * derived from `Display`, which does not follow the declared spelling, so the
 * root spelling must be invisible to a reader who is opening files rather than editing
 * configuration; and the two spellings now legitimately differ in one message.
 *
 *  1. Root a Markdown reference at an absolute directory holding one document.
 *  2. Leave its selected section uncited.
 *  3. Assert the location ascends project-relatively and the target does not.
 * @evidence contracts/testing.md#behavioral-verification runRootedGraphIn runs the graph rule with a Markdown reference rooted at the absolute temp `docs` directory (a sibling of the project) over requirements/**, with the one section left uncited; the test requires `Missing acknowledgement for 'requirements/pricing.md#discounts'` and a message containing `at ../docs/requirements/pricing.md:1`.
 * @evidence contracts/testing.md#independent-expectations Both strings are authored literals: the target is addressed relative to the declared root, while the file location ascends project-relatively so a reader can open it from the project directory.
 * @evidence contracts/testing.md#distinguishing-cases The target spelling (root-relative) and the location spelling (project-relative) must differ in the same diagnostic; a resolver that used either spelling for both would fail one of the two assertions.
 * @evidence contracts/testing.md#execution-ownership TestAnAbsoluteRootLeavesFileLocationsProjectRelative is a Go unit entry in the native test process; runRootedGraphIn writes the workspace to a temp directory and calls the graph rule directly, with no consumer install or product host.
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
