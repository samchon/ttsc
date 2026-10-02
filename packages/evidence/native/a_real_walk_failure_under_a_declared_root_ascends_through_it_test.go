package evidence

import (
  "os"
  "path/filepath"
  "testing"
)

/**
 * Verifies a real walk failure under a declared root ascends through that root.
 *
 * `relativeProjectPath` answers relative to the base rather than to the project,
 * so a base above the project would otherwise print a path a reader cannot open
 * from where they are standing. Composing it through the base is what re-attaches
 * the root, and only a base that actually ascends proves it.
 *
 *  1. Root a Markdown reference above the project.
 *  2. Make a directory inside it unreadable and run the rule.
 *  3. Assert the failure ascends exactly as the file locations beside it do.
 *
 * @evidence contracts/testing.md#behavioral-verification The test makes documents/requirements/private unreadable (skipping where permissions cannot be dropped) and runRootedGraphIn runs the graph rule with a Markdown reference rooted at `../documents` over requirements/**\/*.md; it requires a diagnostic containing `could not inspect '../documents/requirements/private':`.
 * @evidence contracts/testing.md#independent-expectations The expected spelling is the authored root-relative path a reader can open from the project directory, written as a literal rather than derived from the walker.
 * @evidence contracts/testing.md#distinguishing-cases The root ascends out of the project, the case where a base-relative path without the root prefix would be wrong; the non-ascending Markdown case is owned by the sibling project-relative entry. Only containment of the single message is asserted.
 * @evidence contracts/testing.md#execution-ownership TestARealWalkFailureUnderADeclaredRootAscendsThroughIt is a Go unit entry in the native test process; runRootedGraphIn drives the graph rule over a real temp workspace, with no consumer install or product host, and the test skips where permissions cannot be dropped.
 */
func TestARealWalkFailureUnderADeclaredRootAscendsThroughIt(t *testing.T) {
  workspace := t.TempDir()
  private := filepath.Join(workspace, "documents", "requirements", "private")
  if err := os.MkdirAll(private, 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(filepath.Join(private, "hidden.md"), []byte("## Hidden\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  unreadableDirectory(t, private)
  messages := runRootedGraphIn(t, workspace, map[string]string{
    "documents/requirements/pricing.md": "## Discounts {#discounts}\n",
    "project/src/sale.ts":               "export interface ISale {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{
      "type":"markdown",
      "root":"../documents",
      "files":["requirements/**/*.md"],
      "symbol":"h2"
    }
  }]}`)
  assertProblemContains(
    t,
    messages,
    "could not inspect '../documents/requirements/private':",
  )
}
